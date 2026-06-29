// =============================================================================
// GET /api/og  — the default Open Graph / link-preview image (1200x630)
//
// Used by the site's <meta og:image> for the BARE DOMAIN share (per-comp cards
// have their own image via /api/card). "Headline + sample card" layout: a tight
// headline on the left, a representative scouting card on the right, so the link
// preview shows the payoff instead of a naked URL.
//
// Same satori -> resvg pipeline and fonts as /api/card. Node runtime (resvg is
// native). Deterministic + static content, so it caches immutably on the CDN.
// =============================================================================

import type { ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export const runtime = "nodejs";
export const dynamic = "force-static";

const C = {
  card: "#faf6ea",
  bg: "#e9e3d5",
  ink: "#211e17",
  green: "#2f6043",
  muted: "#6b655a",
  faint: "#a8a090",
  body: "#4a463d",
} as const;

interface FontSpec {
  name: string;
  weight: 400 | 500 | 600 | 700;
  url: string;
}
const FONTS: FontSpec[] = [
  { name: "Barlow Condensed", weight: 600, url: "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-600-normal.ttf" },
  { name: "Barlow Condensed", weight: 700, url: "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-700-normal.ttf" },
  { name: "Inter", weight: 400, url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf" },
  { name: "JetBrains Mono", weight: 500, url: "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-500-normal.ttf" },
];
type LoadedFont = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let _fontCache: LoadedFont[] | null = null;
async function loadFonts(): Promise<LoadedFont[]> {
  if (_fontCache) return _fontCache;
  _fontCache = await Promise.all(
    FONTS.map(async (s) => {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`font ${res.status} ${s.name} ${s.weight}`);
      return { name: s.name, data: await res.arrayBuffer(), weight: s.weight, style: "normal" as const };
    }),
  );
  return _fontCache;
}

type El = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
function el(type: string, style: Record<string, unknown>, children?: unknown): El {
  return { type, props: { style: { display: "flex", ...style }, children } };
}

const mono = "JetBrains Mono";
const display = "Barlow Condensed";
const body = "Inter";

// A representative sample card (right side). Hardcoded — this is marketing art,
// not a real comp.
function sampleCard(): El {
  const badge = (label: string, color: string) =>
    el(
      "div",
      {
        fontFamily: mono,
        fontWeight: 500,
        fontSize: 17,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: "5px 10px",
        marginRight: 8,
        marginBottom: 8,
        flexShrink: 0,
      },
      label,
    );
  return el(
    "div",
    {
      flexDirection: "column",
      width: 470,
      background: C.card,
      border: "1px solid rgba(33,30,23,0.24)",
      borderRadius: 12,
      padding: 36,
      flexShrink: 0,
      transform: "rotate(2deg)",
    },
    [
      el("div", { fontFamily: mono, fontWeight: 500, fontSize: 15, color: C.muted, letterSpacing: "0.22em", marginBottom: 18 }, "[ SCOUTING REPORT ]"),
      el(
        "div",
        { justifyContent: "space-between", alignItems: "flex-start", width: "100%", marginBottom: 8 },
        [
          el("div", { fontFamily: display, fontWeight: 700, fontSize: 60, lineHeight: 0.9, color: C.ink, textTransform: "uppercase", letterSpacing: "-0.01em", flex: 1 }, "Manu Ginobili"),
          el(
            "div",
            { flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: 14 },
            [
              el("div", { fontFamily: display, fontWeight: 700, fontSize: 58, lineHeight: 0.84, color: C.green }, "84"),
              el("div", { fontFamily: mono, fontWeight: 500, fontSize: 13, color: C.muted, letterSpacing: "0.24em", marginTop: 2 }, "OVR"),
            ],
          ),
        ],
      ),
      el("div", { fontFamily: mono, fontWeight: 500, fontSize: 16, color: C.muted, letterSpacing: "0.14em", marginBottom: 18 }, "GUARD · 2000s-2010s"),
      el("div", { fontFamily: display, fontWeight: 600, fontSize: 26, color: C.green, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 20 }, "The Sixth-Man Assassin"),
      el("div", { height: 1, width: "100%", background: "rgba(47,96,67,0.3)", marginBottom: 18, flexShrink: 0 }),
      el("div", { flexWrap: "wrap", width: "100%", marginBottom: 14 }, [
        badge("Closer Instinct", "#bd5024"),
        badge("Won't Start", "#356287"),
        badge("Big-Game Gene", "#3a8054"),
      ]),
      el(
        "div",
        { justifyContent: "space-between", width: "100%" },
        [
          el("div", { fontFamily: mono, fontWeight: 500, fontSize: 17, color: C.ink, letterSpacing: "0.04em" }, "$142M · 4 YRS"),
          el("div", { fontFamily: mono, fontWeight: 500, fontSize: 17, color: C.green, letterSpacing: "0.04em" }, "R2, #57"),
        ],
      ),
    ],
  );
}

function buildOg(): El {
  return el(
    "div",
    { width: 1200, height: 630, background: C.bg, padding: 64, alignItems: "center", fontFamily: body },
    [
      // left: headline + url
      el(
        "div",
        { flexDirection: "column", justifyContent: "center", flex: 1, marginRight: 40 },
        [
          el("div", { flexDirection: "column", marginBottom: 28 }, [
            el("div", { fontFamily: display, fontWeight: 700, fontSize: 88, lineHeight: 0.95, color: C.ink, textTransform: "uppercase", letterSpacing: "-0.01em" }, "Which"),
            el("div", { fontFamily: display, fontWeight: 700, fontSize: 88, lineHeight: 0.95, color: C.green, textTransform: "uppercase", letterSpacing: "-0.01em" }, "NBA player"),
            el("div", { fontFamily: display, fontWeight: 700, fontSize: 88, lineHeight: 0.95, color: C.ink, textTransform: "uppercase", letterSpacing: "-0.01em" }, "is your"),
            el("div", { fontFamily: display, fontWeight: 700, fontSize: 88, lineHeight: 0.95, color: C.ink, textTransform: "uppercase", letterSpacing: "-0.01em" }, "career?"),
          ]),
          el("div", { fontFamily: mono, fontWeight: 500, fontSize: 22, color: C.green, letterSpacing: "0.18em" }, "careerplayercomp.com"),
        ],
      ),
      sampleCard(),
    ],
  );
}

export async function GET(): Promise<Response> {
  try {
    const fonts = await loadFonts();
    const svg = await satori(buildOg() as unknown as ReactNode, {
      width: 1200,
      height: 630,
      fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight as 400 | 500 | 600 | 700, style: f.style })),
    });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[og] render failed:", err);
    return new Response("OG render failed.", { status: 500 });
  }
}
