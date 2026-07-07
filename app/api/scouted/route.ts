// =============================================================================
// GET /api/scouted  — the public "careers scouted" total (landing social proof)
//
// Returns: 200 { total: number, today: number }   both >= 0\n// today = runs so far this UTC day (reads the existing cpc:spend:<day> counter)
//
// Reads the global Redis counter `cpc:scouted:total` that /api/generate-comp
// INCRs on every successful comp (see recordScouted there). Read-only: it never
// increments. No user content is stored or read — only the counter — so this
// stays consistent with the no-storage promise.
//
// Graceful no-op: when Upstash isn't configured (dev / unprovisioned) or on any
// infra blip, returns { total: 0 }. The landing hides the line at 0, so a missing
// store just means no social-proof line rather than an error.
// =============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // Accept either the native Upstash names OR the Vercel-Upstash marketplace
  // names (KV_REST_API_*), matching /api/generate-comp's detection exactly.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return Response.json({ total: 0, today: 0 }, { status: 200 });
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    // Today's velocity: the per-UTC-day run counter that /api/generate-comp
    // already INCRs for the daily spend cap. Read-only here; ~= scouts today.
    const day = new Date().toISOString().slice(0, 10);
    const [rawTotal, rawToday] = await redis.mget<(number | string | null)[]>(
      "cpc:scouted:total",
      `cpc:spend:${day}`,
    );
    const total = typeof rawTotal === "number" ? rawTotal : Number(rawTotal ?? 0);
    const today = typeof rawToday === "number" ? rawToday : Number(rawToday ?? 0);
    return Response.json(
      {
        total: Number.isFinite(total) && total > 0 ? total : 0,
        today: Number.isFinite(today) && today > 0 ? today : 0,
      },
      {
        status: 200,
        // Let the edge/CDN cache the count briefly so a viral spike doesn't hit
        // Redis on every landing view; still fresh enough to feel live.
        headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
      },
    );
  } catch {
    return Response.json({ total: 0, today: 0 }, { status: 200 });
  }
}
