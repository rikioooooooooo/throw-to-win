import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { verifyTurnstile, createHmacSignature } from "@/lib/server-utils";

/** Maximum active (unused, unexpired) challenges per device */
const MAX_ACTIVE_CHALLENGES = 5;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
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
      return NextResponse.json(
        { error: "Turnstile verification failed" },
        { status: 403 },
      );
    }

    // Rate limit: reject if device has too many active challenges
    const activeCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM challenges WHERE device_id = ? AND used = 0 AND expires_at > datetime('now')",
    )
      .bind(body.deviceFingerprint)
      .first<{ cnt: number }>();

    if (activeCount && activeCount.cnt >= MAX_ACTIVE_CHALLENGES) {
      return NextResponse.json(
        { error: "Too many active challenges — try again later" },
        { status: 429 },
      );
    }

    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const signature = await createHmacSignature(
      `${nonce}:${timestamp}`,
      env.SERVER_SECRET,
    );
    const expiresAt = new Date(timestamp + 5 * 60 * 1000).toISOString();

    // Insert nonce + clean up expired challenges in one batch
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)",
      ).bind(nonce, body.deviceFingerprint, expiresAt),
      env.DB.prepare(
        "DELETE FROM challenges WHERE expires_at < datetime('now')",
      ),
    ]);

    return NextResponse.json({ nonce, timestamp, signature, expiresAt });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
