"use client";

import { requestChallenge, submitThrow, ChallengeFlowError, type VerifyResponse } from "./challenge";
import type { AccelSample } from "./types";

type SubmitArgs = {
  readonly fp: string;
  readonly heightMeters: number;
  readonly airtimeSeconds: number;
  readonly sensorSamples: readonly AccelSample[];
  readonly displayName: string;
  readonly onSuccess: (result: VerifyResponse) => void;
  readonly onFailure: (err: ChallengeFlowError) => void;
  readonly getTurnstileToken: () => string | null;
  readonly onTurnstileReset: () => void;
};

const MAX_RETRIES = 3;
const TURNSTILE_POLL_INTERVAL_MS = 100;
const TURNSTILE_MAX_WAIT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTurnstileToken(
  getTurnstileToken: () => string | null,
): Promise<string | null> {
  const deadline = Date.now() + TURNSTILE_MAX_WAIT_MS;
  let interval = TURNSTILE_POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    const token = getTurnstileToken();
    if (token) return token;
    await sleep(interval);
    // Exponential backoff up to 1s
    interval = Math.min(interval * 2, 1000);
  }

  return null;
}

const RETRIABLE_ERRORS = new Set([
  "network_error",
  "nonce_expired",
  "nonce_used",
  "server_error",
  "timestamp_skew",
]);

export function submitWithRetry(args: SubmitArgs): void {
  const {
    fp,
    heightMeters,
    airtimeSeconds,
    sensorSamples,
    displayName,
    onSuccess,
    onFailure,
    getTurnstileToken,
    onTurnstileReset,
  } = args;

  async function attempt(retriesLeft: number): Promise<void> {
    // 1. Wait for Turnstile token
    const token = await waitForTurnstileToken(getTurnstileToken);
    if (!token) {
      const err = new ChallengeFlowError(
        "turnstile_failed",
        "Turnstile token not available after 8s",
      );
      if (retriesLeft > 0) {
        onTurnstileReset();
        const backoff = (MAX_RETRIES - retriesLeft + 1) * 1000;
        await sleep(backoff);
        return attempt(retriesLeft - 1);
      }
      onFailure(err);
      return;
    }

    // 2. Request fresh challenge
    let challengeData;
    try {
      challengeData = await requestChallenge(fp, token);
    } catch (rawErr) {
      const err = rawErr instanceof ChallengeFlowError
        ? rawErr
        : new ChallengeFlowError("server_error", String(rawErr));

      if (err.code === "turnstile_failed") {
        // Reset Turnstile widget and retry
        onTurnstileReset();
        if (retriesLeft > 0) {
          const backoff = (MAX_RETRIES - retriesLeft + 1) * 1000;
          await sleep(backoff);
          return attempt(retriesLeft - 1);
        }
        onFailure(err);
        return;
      }

      if (err.code === "rate_limited") {
        if (retriesLeft > 0) {
          await sleep(5000);
          return attempt(retriesLeft - 1);
        }
        onFailure(err);
        return;
      }

      if (RETRIABLE_ERRORS.has(err.code) && retriesLeft > 0) {
        const backoff = (MAX_RETRIES - retriesLeft + 1) * 1000;
        await sleep(backoff);
        return attempt(retriesLeft - 1);
      }

      onFailure(err);
      return;
    }

    // 3. Submit throw
    try {
      const result = await submitThrow(
        challengeData,
        { heightMeters, airtimeSeconds },
        sensorSamples,
        fp,
        displayName,
      );
      onSuccess(result);
    } catch (rawErr) {
      const err = rawErr instanceof ChallengeFlowError
        ? rawErr
        : new ChallengeFlowError("server_error", String(rawErr));

      // Never retry for cheat_detected or signature_invalid
      if (err.code === "cheat_detected" || err.code === "signature_invalid") {
        onFailure(err);
        return;
      }

      if (RETRIABLE_ERRORS.has(err.code) && retriesLeft > 0) {
        const backoff = (MAX_RETRIES - retriesLeft + 1) * 1000;
        await sleep(backoff);
        return attempt(retriesLeft - 1);
      }

      onFailure(err);
    }
  }

  attempt(MAX_RETRIES).catch((unexpectedErr) => {
    onFailure(
      new ChallengeFlowError("server_error", String(unexpectedErr)),
    );
  });
}
