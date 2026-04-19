import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type PostRow = {
  id: number;
  display_name: string;
  body: string;
  height_meters: number;
  country: string;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const beforeId = parseInt(url.searchParams.get("before_id") ?? "0", 10) || 0;
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "30", 10) || 30));

    const { env } = await getCloudflareContext({ async: true });

    const query = beforeId > 0
      ? "SELECT p.id, d.display_name, p.body, p.height_meters, p.country, p.created_at FROM posts p JOIN devices d ON p.device_id = d.id WHERE p.deleted = 0 AND p.id < ? ORDER BY p.id DESC LIMIT ?"
      : "SELECT p.id, d.display_name, p.body, p.height_meters, p.country, p.created_at FROM posts p JOIN devices d ON p.device_id = d.id WHERE p.deleted = 0 ORDER BY p.id DESC LIMIT ?";

    const stmt = env.DB.prepare(query);
    const bound = beforeId > 0 ? stmt.bind(beforeId, limit + 1) : stmt.bind(limit + 1);
    const result = await bound.all<PostRow>();
    const rows = result.results ?? [];

    const hasMore = rows.length > limit;
    const sliced: PostRow[] = hasMore ? rows.slice(0, limit) : rows;
    const posts = sliced.map((row) => ({
      id: row.id,
      displayName: row.display_name || "",
      body: row.body,
      heightMeters: row.height_meters,
      country: row.country,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      posts,
      hasMore,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reqBody = await request.json();
    const { deviceFingerprint, body: rawBody } = reqBody as { deviceFingerprint?: string; body?: string };

    if (!deviceFingerprint || typeof rawBody !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trimmed = rawBody.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      return NextResponse.json({ error: "Body must be 1-100 characters" }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });

    // Verify device exists and has thrown
    const device = await env.DB.prepare(
      "SELECT id, personal_best FROM devices WHERE id = ? AND total_throws > 0"
    ).bind(deviceFingerprint).first<{ id: string; personal_best: number }>();

    if (!device) {
      return NextResponse.json({ error: "Must have thrown at least once" }, { status: 403 });
    }

    // Rate limit: max 5 posts per hour
    const recentCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM posts WHERE device_id = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(deviceFingerprint).first<{ cnt: number }>();

    if (recentCount && recentCount.cnt >= 5) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const country = request.headers.get("cf-ipcountry") ?? "XX";

    await env.DB.prepare(
      "INSERT INTO posts (device_id, body, height_meters, country) VALUES (?, ?, ?, ?)"
    ).bind(deviceFingerprint, trimmed, device.personal_best, country).run();

    // Posts are permanent — 石碑 (stone monument) style
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
