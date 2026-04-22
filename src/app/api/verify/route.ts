import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { verifyHmacSignature } from "@/lib/server-utils";
import { validateSensorData } from "@/lib/anti-cheat";
import type { AccelSample } from "@/lib/types";

/** Physical limits — anything beyond these is fabricated */
const MAX_HEIGHT_METERS = 30;
const MAX_AIRTIME_SECONDS = 5;
/** Maximum clock skew allowed between client and server (5 minutes) */
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

type VerifyBody = {
  nonce?: string;
  timestamp?: number;
  signature?: string;
  /** Stable localStorage-based UUID (not a volatile browser fingerprint hash) */
  deviceFingerprint?: string;
  heightMeters?: number;
  airtimeSeconds?: number;
  sensorData?: readonly AccelSample[];
  displayName?: string;
};

function isValidNumber(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyBody;

    if (
      !body.nonce ||
      typeof body.timestamp !== "number" ||
      !body.signature ||
      !body.deviceFingerprint ||
      !isValidNumber(body.heightMeters, 0, MAX_HEIGHT_METERS) ||
      !isValidNumber(body.airtimeSeconds, 0, MAX_AIRTIME_SECONDS) ||
      !Array.isArray(body.sensorData) ||
      body.sensorData.length === 0 ||
      body.sensorData.length > 2000
    ) {
      console.error("[verify] Invalid fields:", {
        hasNonce: !!body.nonce,
        timestampType: typeof body.timestamp,
        hasSignature: !!body.signature,
        hasFingerprint: !!body.deviceFingerprint,
        height: body.heightMeters,
        airtime: body.airtimeSeconds,
        sensorCount: Array.isArray(body.sensorData) ? body.sensorData.length : "not-array",
      });
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 },
      );
    }

    // Reject stale timestamps to prevent replay attacks
    if (Math.abs(Date.now() - body.timestamp) > MAX_TIMESTAMP_SKEW_MS) {
      return NextResponse.json(
        { error: "Timestamp too far from server time" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    // Turnstile already verified at /api/challenge — nonce issuance proves bot check passed.

    // 1. Atomically claim challenge nonce (prevents TOCTOU race)
    const claimResult = await env.DB.prepare(
      "UPDATE challenges SET used = 1 WHERE nonce = ? AND used = 0 RETURNING nonce, device_id, expires_at",
    )
      .bind(body.nonce)
      .first<{
        nonce: string;
        device_id: string;
        expires_at: string;
      }>();

    if (!claimResult) {
      // Either nonce doesn't exist, or it was already used
      return NextResponse.json(
        { error: "Challenge nonce not found or already used" },
        { status: 400 },
      );
    }

    if (new Date(claimResult.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Challenge nonce expired" },
        { status: 400 },
      );
    }

    if (claimResult.device_id !== body.deviceFingerprint) {
      return NextResponse.json(
        { error: "Device fingerprint mismatch" },
        { status: 400 },
      );
    }

    // 3. HMAC signature verification
    const signatureValid = await verifyHmacSignature(
      `${body.nonce}:${body.timestamp}`,
      body.signature,
      env.SERVER_SECRET,
    );

    if (!signatureValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      );
    }

    // 4. Anti-cheat sensor validation
    const antiCheatResult = validateSensorData(
      body.sensorData,
      body.heightMeters,
      body.airtimeSeconds,
    );

    // Always trust client's v₀-based height for consistency across video overlay,
    // result screen, localStorage, and ranking DB. Anti-cheat still rejects
    // obvious cheating via anomalyScore >= 0.9 below.
    const verifiedHeight = body.heightMeters;

    // Reject outright if anomaly score is too high
    if (antiCheatResult.anomalyScore >= 0.9) {
      console.error("[verify] Anti-cheat rejected:", {
        anomalyScore: antiCheatResult.anomalyScore,
        failedChecks: antiCheatResult.checks.filter(c => !c.passed).map(c => ({ name: c.name, score: c.score, detail: c.detail })),
      });
      return NextResponse.json(
        { error: "Throw rejected by anti-cheat validation" },
        { status: 422 },
      );
    }

    // 5. Persist throw + device data (atomic upsert, nonce already claimed in step 1)
    const country = request.headers.get("cf-ipcountry") ?? "XX";
    const throwId = crypto.randomUUID();

    // Sanitize displayName (same rules as profile endpoint)
    const MAX_NAME_LENGTH = 20;
    const NAME_PATTERN = /^[\p{L}\p{N}\p{M}\s._-]+$/u;
    let sanitizedName = "";
    if (typeof body.displayName === "string") {
      const trimmed = body.displayName.trim().slice(0, MAX_NAME_LENGTH);
      if (trimmed.length > 0 && NAME_PATTERN.test(trimmed)) {
        sanitizedName = trimmed;
      }
    }

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO devices (id, first_seen, last_seen, total_throws, personal_best, country, flagged, display_name)
           VALUES (?, datetime('now'), datetime('now'), 1, ?, ?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET
             last_seen = datetime('now'),
             total_throws = total_throws + 1,
             personal_best = MAX(personal_best, excluded.personal_best),
             country = excluded.country,
             display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE devices.display_name END`,
        ).bind(body.deviceFingerprint, verifiedHeight, country, sanitizedName),
        env.DB.prepare(
          "INSERT INTO throws (id, device_id, height_meters, airtime_seconds, country, challenge_nonce, anomaly_score) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          throwId,
          body.deviceFingerprint,
          verifiedHeight,
          body.airtimeSeconds,
          country,
          body.nonce,
          antiCheatResult.anomalyScore,
        ),
      ]);
    } catch (dbErr) {
      console.error("[verify] DB batch failed:", dbErr);
      return NextResponse.json({ error: "Database write failed" }, { status: 500 });
    }

    // 7. Fetch updated personal_best + ranks in parallel
    // Rank THIS specific throw (not device's monthly best) so WR badge
    // only shows when this throw itself is the highest, not when a
    // previous throw by the same device was the highest.
    try {
      const rankHeight = verifiedHeight;

      const [updatedDevice, worldRankRow, countryRankRow, totalThrowsRow] =
        await Promise.all([
          env.DB.prepare(
            "SELECT personal_best FROM devices WHERE id = ?",
          )
            .bind(body.deviceFingerprint)
            .first<{ personal_best: number }>(),
          env.DB.prepare(
            "SELECT COUNT(*) as rank FROM (SELECT device_id, MAX(height_meters) as best FROM throws WHERE created_at >= datetime('now', 'start of month') GROUP BY device_id HAVING best > ?)",
          )
            .bind(rankHeight)
            .first<{ rank: number }>(),
          env.DB.prepare(
            "SELECT COUNT(*) as rank FROM (SELECT t.device_id, MAX(t.height_meters) as best FROM throws t JOIN devices d ON t.device_id = d.id WHERE t.created_at >= datetime('now', 'start of month') AND d.country = ? GROUP BY t.device_id HAVING best > ?)",
          )
            .bind(country, rankHeight)
            .first<{ rank: number }>(),
          env.DB.prepare(
            "SELECT COUNT(*) as total FROM throws",
          ).first<{ total: number }>(),
        ]);

      const updatedBest = updatedDevice?.personal_best ?? verifiedHeight;

      return NextResponse.json({
        id: throwId,
        verifiedHeight,
        worldRank: (worldRankRow?.rank ?? 0) + 1,
        countryRank: (countryRankRow?.rank ?? 0) + 1,
        totalThrows: totalThrowsRow?.total ?? 0,
        country,
        personalBest: updatedBest,
      }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" },
      });
    } catch (rankErr) {
      console.error("[verify] Rank query failed (DB write succeeded):", rankErr);
      return NextResponse.json({
        id: throwId,
        verifiedHeight,
        worldRank: 0,
        countryRank: 0,
        totalThrows: 0,
        country,
        personalBest: verifiedHeight,
      }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" },
      });
    }
  } catch (err) {
    console.error("[verify] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
