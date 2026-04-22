import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { verifyTurnstile, createHmacSignature } from "@/lib/server-utils";

/** Maximum active (unused, unexpired) challenges per device */
const MAX_ACTIVE_CHALLENGES = 5;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      /** Stable localStorage-based UUID (not a volatile browser fingerprint hash) */
      deviceFingerprint?: string;
      turnstileToken?: string;
    };

    if (!body.deviceFingerprint || !body.turnstileToken) {
      return NextResponse.json(
        { error: "Missing deviceFingerprint or turnstileToken" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    const turnstileValid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      console.error("[challenge] Turnstile failed for device:", body.deviceFingerprint);
      return NextResponse.json(
        { error: "Turnstile verification failed" },
        { status: 403 },
      );
    }

    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const signature = await createHmacSignature(
      `${nonce}:${timestamp}`,
      env.SERVER_SECRET,
    );
    const expiresAt = new Date(timestamp + 5 * 60 * 1000).toISOString();

    // Atomic rate-limited insert: only inserts if active challenge count < MAX
    // Prevents race condition where concurrent requests bypass the limit
    const insertResult = await env.DB.prepare(
      `INSERT INTO challenges (nonce, device_id, expires_at)
       SELECT ?, ?, ?
       WHERE (SELECT COUNT(*) FROM challenges WHERE device_id = ? AND used = 0 AND expires_at > datetime('now')) < ?`,
    ).bind(nonce, body.deviceFingerprint, expiresAt, body.deviceFingerprint, MAX_ACTIVE_CHALLENGES).run();

    if (!insertResult.meta.changes) {
      console.error("[challenge] Rate limited for device:", body.deviceFingerprint);
      return NextResponse.json(
        { error: "Too many active challenges — try again later" },
        { status: 429 },
      );
    }

    // Clean up expired challenges
    await env.DB.prepare(
      "DELETE FROM challenges WHERE expires_at < datetime('now')",
    ).run();

    return NextResponse.json({ nonce, timestamp, signature, expiresAt });
  } catch (err) {
    console.error("[challenge] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
