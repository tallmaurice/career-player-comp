// =============================================================================
// GET /api/card?data=<base64url comp>&format=feed|story
//
// Renders the scouting card as a PNG, server-side, from the Comp fields passed
// in the query (base64url-encoded JSON). NOTHING is stored: the comp travels in
// the URL the client builds from its in-memory result, and the PNG is generated
// on demand. Results.tsx points Share/Download at this URL.
//
// Pipeline: build a satori-compatible element tree -> satori() -> SVG string ->
// @resvg/resvg-js -> PNG buffer. resvg ships a native binary, so this route MUST
// run on the Node runtime (it is externalized in next.config.mjs); it cannot run
// on edge.
//
// satori supports only a CSS subset (no filters, no 3D transforms, no z-index,
// no background grain). So this is a clean, flat variant of the paper card — it
// does NOT reproduce the on-screen tilt/grain/noise, by design.
//
// Two share sizes:
//   feed  = 1200x630  (Open Graph / Twitter / LinkedIn link card)
//   story = 1080x1920 (IG / vertical)
// =============================================================================

import type { ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Comp, Badge, BadgeCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- palette (matches globals.css :root) -----------------------------------
const C = {
  card: "#faf6ea",
  bg: "#e9e3d5",
  ink: "#211e17",
  green: "#2f6043",
  muted: "#6b655a",
  faint: "#a8a090",
  body: "#4a463d",
} as const;

const BADGE_COLOR: Record<BadgeCategory, string> = {
  skill: "#bd5024",
  temperament: "#356287",
  intangible: "#8f7220",
  tendency: "#3a8054",
};

// ---- fonts (fetched once, cached for the process life) ----------------------
// satori needs raw font bytes (TTF/OTF/WOFF — NOT WOFF2). We pull the exact
// families used on screen from Google Fonts, asking for TTF via an old UA.
interface FontSpec {
  name: string;
  weight: 400 | 500 | 600 | 700;
  family: string; // Google Fonts family query
}

const FONTS: FontSpec[] = [
  { name: "Barlow Condensed", weight: 600, family: "Barlow+Condensed:wght@600" },
  { name: "Barlow Condensed", weight: 700, family: "Barlow+Condensed:wght@700" },
  { name: "Inter", weight: 400, family: "Inter:wght@400" },
  { name: "Inter", weight: 500, family: "Inter:wght@500" },
  { name: "JetBrains Mono", weight: 400, family: "JetBrains+Mono:wght@400" },
  { name: "JetBrains Mono", weight: 500, family: "JetBrains+Mono:wght@500" },
];

type LoadedFont = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let _fontCache: LoadedFont[] | null = null;

// UA string old enough that Google serves TTF (satori can't read WOFF2).
const TTF_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/534.50 (KHTML, like Gecko) Version/5.1 Safari/534.50";

async function loadOneFont(spec: FontSpec): Promise<LoadedFont> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${spec.family}&display=swap`;
  const css = await fetch(cssUrl, { headers: { "User-Agent": TTF_UA } }).then((r) =>
    r.text(),
  );
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?truetype['"]?\)/);
  const url = m?.[1] ?? css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`no TTF url for ${spec.name} ${spec.weight}`);
  const data = await fetch(url).then((r) => r.arrayBuffer());
  return { name: spec.name, data, weight: spec.weight, style: "normal" };
}

async function loadFonts(): Promise<LoadedFont[]> {
  if (_fontCache) return _fontCache;
  _fontCache = await Promise.all(FONTS.map(loadOneFont));
  return _fontCache;
}

// ---- comp decode ------------------------------------------------------------
function decodeComp(dataParam: string | null): Comp | null {
  if (!dataParam) return null;
  try {
    // base64url -> JSON
    const b64 = dataParam.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const o = JSON.parse(json) as Partial<Comp>;
    if (!o || typeof o.player_name !== "string") return null;
    return o as Comp;
  } catch {
    return null;
  }
}

// ---- short stat values (mirror Results.tsx hardening) -----------------------
function tightNumber(raw: string): string {
  const m = (raw ?? "").match(/\d+/);
  if (m) return m[0].padStart(2, "0");
  return (raw ?? "").trim().slice(0, 3).toUpperCase();
}
function tightStatus(raw: string): string {
  const t = (raw ?? "").trim();
  if (t.length <= 14) return t.toUpperCase();
  return t.split(/\s+/).slice(0, 2).join(" ").toUpperCase();
}

// satori element helpers (object form; no JSX needed in the route) -----------
type El = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};
function el(type: string, style: Record<string, unknown>, children?: unknown): El {
  return { type, props: { style, children } };
}

function buildCard(comp: Comp, w: number, h: number): El {
  const story = h > w;
  const pad = story ? 88 : 64;
  const badges = (comp.badges ?? []).slice(0, 3);
  const stat = {
    seasons: tightNumber(comp.stat_line?.seasons ?? ""),
    teams: tightNumber(comp.stat_line?.teams ?? ""),
    pivots: tightNumber(comp.stat_line?.pivots ?? ""),
    status: tightStatus(comp.stat_line?.contract_status ?? ""),
  };

  const nameSize = story ? 132 : 92;
  const archSize = story ? 40 : 30;
  const summarySize = story ? 30 : 23;

  const mono = "JetBrains Mono";
  const display = "Barlow Condensed";
  const body = "Inter";

  const divider = (color: string, mb: number) =>
    el("div", { display: "flex", height: 1, background: color, marginBottom: mb });

  const statCell = (label: string, value: string, accent = false) =>
    el(
      "div",
      { display: "flex", flexDirection: "column", flex: 1 },
      [
        el(
          "div",
          {
            fontFamily: mono,
            fontSize: story ? 18 : 14,
            color: C.faint,
            letterSpacing: "0.16em",
            marginBottom: 6,
          },
          label,
        ),
        el(
          "div",
          {
            fontFamily: mono,
            fontWeight: 500,
            fontSize: story ? 34 : 26,
            color: accent ? C.green : C.ink,
          },
          value,
        ),
      ],
    );

  return el(
    "div",
    {
      display: "flex",
      width: w,
      height: h,
      background: C.bg,
      padding: story ? 60 : 40,
      fontFamily: body,
    },
    [
      // the paper card itself
      el(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: C.card,
          border: "1px solid rgba(33,30,23,0.24)",
          borderRadius: 10,
          padding: pad,
          justifyContent: "flex-start",
        },
        [
          // header row
          el(
            "div",
            {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: story ? 40 : 26,
            },
            [
              el(
                "div",
                {
                  fontFamily: mono,
                  fontWeight: 500,
                  fontSize: story ? 22 : 16,
                  color: C.muted,
                  letterSpacing: "0.22em",
                },
                "[ SCOUTING REPORT ]",
              ),
              el(
                "div",
                {
                  fontFamily: mono,
                  fontSize: story ? 20 : 15,
                  color: C.green,
                  letterSpacing: "0.18em",
                  border: "1px solid rgba(47,96,67,0.5)",
                  borderRadius: 3,
                  padding: "5px 10px",
                },
                "CLASS A",
              ),
            ],
          ),
          // player name
          el(
            "div",
            {
              fontFamily: display,
              fontWeight: 700,
              fontSize: nameSize,
              lineHeight: 0.92,
              color: C.ink,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              marginBottom: 14,
            },
            comp.player_name,
          ),
          // position / era
          el(
            "div",
            {
              fontFamily: mono,
              fontWeight: 500,
              fontSize: story ? 24 : 18,
              color: C.muted,
              letterSpacing: "0.14em",
              marginBottom: story ? 28 : 18,
            },
            comp.position_era,
          ),
          // archetype
          el(
            "div",
            {
              fontFamily: display,
              fontWeight: 600,
              fontSize: archSize,
              color: C.green,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: story ? 28 : 18,
            },
            comp.archetype_title,
          ),
          divider("rgba(47,96,67,0.3)", story ? 28 : 18),
          // badges
          el(
            "div",
            {
              display: "flex",
              flexWrap: "wrap",
              marginBottom: story ? 32 : 22,
            },
            badges.map((b: Badge) => {
              const color = BADGE_COLOR[b.category] ?? C.green;
              return el(
                "div",
                {
                  display: "flex",
                  fontFamily: mono,
                  fontWeight: 500,
                  fontSize: story ? 22 : 17,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color,
                  border: `1px solid ${color}`,
                  borderRadius: 4,
                  padding: story ? "8px 14px" : "6px 11px",
                  marginRight: 10,
                  marginBottom: 10,
                },
                b.label,
              );
            }),
          ),
          // card summary
          el(
            "div",
            {
              display: "flex",
              fontFamily: body,
              fontWeight: 400,
              fontSize: summarySize,
              lineHeight: 1.5,
              color: C.body,
              marginBottom: story ? 40 : 28,
            },
            comp.card_summary,
          ),
          // spacer pushes the stat line + watermark to the bottom
          el("div", { display: "flex", flex: 1 }),
          divider("rgba(33,30,23,0.14)", story ? 24 : 16),
          // stat line
          el(
            "div",
            { display: "flex", marginBottom: story ? 28 : 18 },
            [
              statCell("SEASONS", stat.seasons),
              statCell("TEAMS", stat.teams),
              statCell("PIVOTS", stat.pivots),
              statCell("STATUS", stat.status, true),
            ],
          ),
          // watermark
          el(
            "div",
            {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
            [
              el(
                "div",
                {
                  fontFamily: mono,
                  fontSize: story ? 22 : 16,
                  color: C.green,
                  letterSpacing: "0.16em",
                },
                "careerplayercomp.com",
              ),
              el(
                "div",
                {
                  fontFamily: mono,
                  fontSize: story ? 18 : 13,
                  color: C.faint,
                  letterSpacing: "0.18em",
                },
                "FILE No. 2026-4471",
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

const SIZES = {
  feed: { w: 1200, h: 630 },
  story: { w: 1080, h: 1920 },
} as const;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const comp = decodeComp(url.searchParams.get("data"));
  if (!comp) {
    return new Response("Missing or invalid card data.", { status: 400 });
  }
  const format = url.searchParams.get("format") === "story" ? "story" : "feed";
  const { w, h } = SIZES[format];

  try {
    const fonts = await loadFonts();
    const svg = await satori(buildCard(comp, w, h) as unknown as ReactNode, {
      width: w,
      height: h,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight as 400 | 500 | 600 | 700,
        style: f.style,
      })),
    });

    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: w },
    })
      .render()
      .asPng();

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // The card is deterministic for a given data param; let the CDN cache it.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[card] render failed:", err);
    return new Response("Card render failed.", { status: 500 });
  }
}
