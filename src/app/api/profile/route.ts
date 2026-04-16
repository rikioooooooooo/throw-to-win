import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

const MAX_NAME_LENGTH = 20;
const NAME_PATTERN = /^[\p{L}\p{N}\p{M}\s._-]+$/u;

type ProfileBody = {
  deviceFingerprint?: string;
  displayName?: string;
};

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ProfileBody;

    if (!body.deviceFingerprint || typeof body.displayName !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const name = body.displayName.trim();

    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be 1-${MAX_NAME_LENGTH} characters` },
        { status: 400 },
      );
    }

    if (!NAME_PATTERN.test(name)) {
      return NextResponse.json(
        { error: "Name contains invalid characters" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    const result = await env.DB.prepare(
      "UPDATE devices SET display_name = ? WHERE id = ? RETURNING id",
    )
      .bind(name, body.deviceFingerprint)
      .first<{ id: string }>();

    if (!result) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ displayName: name });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
