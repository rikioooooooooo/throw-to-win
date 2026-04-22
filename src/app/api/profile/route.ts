import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { sanitizeDisplayName, validateDisplayName } from "@/lib/sanitize-name";

type ProfileBody = {
  /** Stable localStorage-based UUID (not a volatile browser fingerprint hash) */
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

    const name = sanitizeDisplayName(body.displayName);
    const validationError = validateDisplayName(name);
    if (validationError) {
      return NextResponse.json(
        { error: "Name must be 1-20 characters and contain only allowed characters" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    // Check if the name is already taken by a different device
    const existing = await env.DB.prepare(
      "SELECT id FROM devices WHERE display_name = ? AND id != ?",
    )
      .bind(name, body.deviceFingerprint)
      .first<{ id: string }>();

    if (existing) {
      return NextResponse.json(
        { error: "Name already taken", code: "name_taken" },
        { status: 409 },
      );
    }

    // Update with try/catch for UNIQUE constraint violation race condition
    let result: { id: string } | null;
    try {
      result = await env.DB.prepare(
        "UPDATE devices SET display_name = ? WHERE id = ? RETURNING id",
      )
        .bind(name, body.deviceFingerprint)
        .first<{ id: string }>();
    } catch (dbErr) {
      if (String(dbErr).includes("UNIQUE")) {
        return NextResponse.json(
          { error: "Name already taken", code: "name_taken" },
          { status: 409 },
        );
      }
      throw dbErr;
    }

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
