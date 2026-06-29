// =============================================================================
// GET /api/scouted  — the public "careers scouted" total (landing social proof)
//
// Returns: 200 { total: number }   total >= 0
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
    return Response.json({ total: 0 }, { status: 200 });
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    const raw = await redis.get<number | string | null>("cpc:scouted:total");
    const total = typeof raw === "number" ? raw : Number(raw ?? 0);
    return Response.json(
      { total: Number.isFinite(total) && total > 0 ? total : 0 },
      {
        status: 200,
        // Let the edge/CDN cache the count briefly so a viral spike doesn't hit
        // Redis on every landing view; still fresh enough to feel live.
        headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
      },
    );
  } catch {
    return Response.json({ total: 0 }, { status: 200 });
  }
}
