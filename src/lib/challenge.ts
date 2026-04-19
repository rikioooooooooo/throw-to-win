"use client";

import type { AccelSample } from "./types";

export type ChallengeResponse = {
  readonly nonce: string;
  readonly timestamp: number;
  readonly signature: string;
  readonly expiresAt: string;
};

export type VerifyResponse = {
  readonly id: string;
  readonly verifiedHeight: number;
  readonly worldRank: number;
  readonly countryRank: number;
  readonly totalThrows: number;
  readonly country: string;
  readonly personalBest?: number;
};

export type ChallengeError =
  | "turnstile_failed"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "nonce_expired"
  | "nonce_used"
  | "signature_invalid"
  | "cheat_detected"
  | "unknown";

export class ChallengeFlowError extends Error {
  readonly code: ChallengeError;

  constructor(code: ChallengeError, message: string) {
    super(message);
    this.code = code;
  }
}

function mapErrorCode(status: number, body: { error?: string }): ChallengeError {
  if (status === 403 && body.error?.includes("Turnstile")) return "turnstile_failed";
  if (status === 429) return "rate_limited";
  if (status === 400 && body.error?.includes("expired")) return "nonce_expired";
  if (status === 400 && body.error?.includes("used")) return "nonce_used";
  if (status === 400 && body.error?.includes("signature")) return "signature_invalid";
  if (status === 422) return "cheat_detected";
  if (status >= 500) return "server_error";
  return "unknown";
}

export async function requestChallenge(
  fingerprint: string,
  turnstileToken: string,
): Promise<ChallengeResponse> {
  let res: Response;
  try {
    res = await fetch("/api/challenge/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceFingerprint: fingerprint,
        turnstileToken,
      }),
    });
  } catch {
    throw new ChallengeFlowError("network_error", "Network request failed");
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ChallengeFlowError(
      mapErrorCode(res.status, body),
      body.error ?? "Challenge request failed",
    );
  }

  return body as ChallengeResponse;
}

export async function submitThrow(
  challengeData: ChallengeResponse,
  throwResult: { heightMeters: number; airtimeSeconds: number },
  sensorSamples: readonly AccelSample[],
  fingerprint: string,
  displayName: string,
): Promise<VerifyResponse> {
  let res: Response;
  try {
    res = await fetch("/api/verify/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: challengeData.nonce,
        timestamp: challengeData.timestamp,
        signature: challengeData.signature,
        deviceFingerprint: fingerprint,
        heightMeters: throwResult.heightMeters,
        airtimeSeconds: throwResult.airtimeSeconds,
        sensorData: sensorSamples,
        displayName,
      }),
    });
  } catch {
    throw new ChallengeFlowError("network_error", "Network request failed");
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ChallengeFlowError(
      mapErrorCode(res.status, body),
      body.error ?? "Verification failed",
    );
  }

  return body as VerifyResponse;
}
