import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { verifyTurnstile, createHmacSignature } from "@/lib/server-utils";

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

    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const signature = await createHmacSignature(
      `${nonce}:${timestamp}`,
      env.SERVER_SECRET,
    );
    const expiresAt = new Date(timestamp + 5 * 60 * 1000).toISOString();

    await env.DB.prepare(
      "INSERT INTO challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)",
    )
      .bind(nonce, body.deviceFingerprint, expiresAt)
      .run();

    return NextResponse.json({ nonce, timestamp, signature, expiresAt });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
