import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

/** Returns public-safe configuration values to the client */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return NextResponse.json({
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
