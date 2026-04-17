import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type CountryRow = {
  country: string;
  throws: number;
  players: number;
  best: number;
};

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });

    const result = await env.DB.prepare(`
      SELECT country, COUNT(*) as throws, COUNT(DISTINCT device_id) as players, MAX(height_meters) as best
      FROM throws
      WHERE country != 'XX'
      GROUP BY country
      ORDER BY throws DESC
    `).all<CountryRow>();

    return NextResponse.json({
      countries: result.results ?? [],
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
