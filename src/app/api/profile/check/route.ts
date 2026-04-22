import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { sanitizeDisplayName, validateDisplayName } from "@/lib/sanitize-name";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawName = url.searchParams.get("name") ?? "";
    const deviceId = url.searchParams.get("deviceId") ?? "";

    const name = sanitizeDisplayName(rawName);
    const validationError = validateDisplayName(name);
    if (validationError) {
      return NextResponse.json({ available: false, reason: validationError });
    }

    const { env } = await getCloudflareContext({ async: true });

    const query = deviceId
      ? "SELECT 1 as taken FROM devices WHERE display_name = ? AND id != ? LIMIT 1"
      : "SELECT 1 as taken FROM devices WHERE display_name = ? LIMIT 1";
    const bound = deviceId
      ? env.DB.prepare(query).bind(name, deviceId)
      : env.DB.prepare(query).bind(name);
    const taken = await bound.first<{ taken: number }>();

    return NextResponse.json(
      { available: !taken, reason: taken ? "taken" : null },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err) {
    console.error("[profile/check] Error:", err);
    return NextResponse.json({ available: false, reason: "server_error" }, { status: 500 });
  }
}
