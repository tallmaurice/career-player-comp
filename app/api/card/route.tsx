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
  url: string; // direct TrueType (.ttf) url — satori cannot read WOFF2
}

// Direct TTF files from jsdelivr's fontsource mirror. The old Google Fonts css2
// + spoofed-old-UA trick stopped serving TTF (it returns WOFF2 now, which satori
// can't parse) — that was the "card render failed" bug. These URLs serve raw
// .ttf (sig 0x00010000), verified end-to-end through satori + resvg.
const FONTS: FontSpec[] = [
  { name: "Barlow Condensed", weight: 600, url: "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-600-normal.ttf" },
  { name: "Barlow Condensed", weight: 700, url: "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-700-normal.ttf" },
  { name: "Inter", weight: 400, url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf" },
  { name: "Inter", weight: 500, url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf" },
  { name: "JetBrains Mono", weight: 400, url: "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.ttf" },
  { name: "JetBrains Mono", weight: 500, url: "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-500-normal.ttf" },
];

type LoadedFont = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let _fontCache: LoadedFont[] | null = null;

async function loadOneFont(spec: FontSpec): Promise<LoadedFont> {
  const res = await fetch(spec.url);
  if (!res.ok)
    throw new Error(`font fetch ${res.status} for ${spec.name} ${spec.weight}`);
  const data = await res.arrayBuffer();
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
// satori only does flexbox, and every node needs an explicit display:flex or it
// gets a zero/wrong measured height and siblings overlap. Default it on for every
// element here (callers can still override by passing their own `display`).
function el(type: string, style: Record<string, unknown>, children?: unknown): El {
  return { type, props: { style: { display: "flex", ...style }, children } };
}

function buildCard(comp: Comp, w: number, h: number): El {
  const story = h > w;
  const pad = story ? 88 : 44;
  const badges = (comp.badges ?? []).slice(0, 3);
  const stat = {
    seasons: tightNumber(comp.stat_line?.seasons ?? ""),
    teams: tightNumber(comp.stat_line?.teams ?? ""),
    pivots: tightNumber(comp.stat_line?.pivots ?? ""),
    status: tightStatus(comp.stat_line?.contract_status ?? ""),
  };

  // feed (1200x630) is a short, wide banner: far less vertical room than story
  // (1080x1920), so it runs tighter type and spacing or the content overruns the
  // frame. story can breathe.
  const nameSize = story ? 132 : 64;
  const archSize = story ? 40 : 24;
  const summarySize = story ? 30 : 19;

  const mono = "JetBrains Mono";
  const display = "Barlow Condensed";
  const body = "Inter";

  const divider = (color: string, mb: number) =>
    el("div", {
      height: 1,
      width: "100%",
      flexShrink: 0,
      background: color,
      marginBottom: mb,
    });

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
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 40 : 20,
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
          // player name + OVR/POT hero badge (2K-style overall rating)
          el(
            "div",
            {
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 14 : 10,
            },
            [
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
                  flex: 1,
                  minWidth: 0,
                  marginRight: story ? 24 : 16,
                },
                comp.player_name,
              ),
              el(
                "div",
                { flexDirection: "column", alignItems: "flex-end", flexShrink: 0 },
                [
                  el(
                    "div",
                    {
                      fontFamily: display,
                      fontWeight: 700,
                      fontSize: story ? 116 : 58,
                      lineHeight: 0.84,
                      color: C.green,
                      letterSpacing: "-0.01em",
                    },
                    String(comp.ovr ?? ""),
                  ),
                  el(
                    "div",
                    {
                      fontFamily: mono,
                      fontWeight: 500,
                      fontSize: story ? 22 : 13,
                      color: C.muted,
                      letterSpacing: "0.24em",
                      marginTop: story ? 4 : 2,
                    },
                    "OVR",
                  ),
                  el(
                    "div",
                    {
                      fontFamily: mono,
                      fontWeight: 500,
                      fontSize: story ? 18 : 11,
                      color: C.faint,
                      letterSpacing: "0.14em",
                      marginTop: story ? 8 : 4,
                    },
                    `POT ${comp.pot ?? ""}`,
                  ),
                ],
              ),
            ],
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
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 28 : 14,
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
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 28 : 14,
            },
            comp.archetype_title,
          ),
          divider("rgba(47,96,67,0.3)", story ? 28 : 12),
          // badges
          el(
            "div",
            {
              flexWrap: "wrap",
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 32 : 14,
            },
            badges.map((b: Badge) => {
              const color = BADGE_COLOR[b.category] ?? C.green;
              return el(
                "div",
                {
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
                  flexShrink: 0,
                },
                b.label,
              );
            }),
          ),
          // card summary
          el(
            "div",
            {
              fontFamily: body,
              fontWeight: 400,
              fontSize: summarySize,
              lineHeight: story ? 1.5 : 1.4,
              color: C.body,
              width: "100%",
              flexShrink: 0,
              marginBottom: story ? 40 : 14,
            },
            comp.card_summary,
          ),
          // spacer pushes the stat line + watermark to the bottom.
          // minHeight:0 lets this be the only thing that shrinks when the frame
          // is short (the feed size), so the fixed rows above keep their height.
          el("div", { flex: 1, minHeight: 0 }),
          divider("rgba(33,30,23,0.14)", story ? 24 : 10),
          // stat line
          el(
            "div",
            { width: "100%", flexShrink: 0, marginBottom: story ? 28 : 10 },
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
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              flexShrink: 0,
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
