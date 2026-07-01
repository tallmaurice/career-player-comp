"use client";

// =============================================================================
// Career Player Comp — Screen 03: Results
// Faithful conversion of design-export Screen "03 · RESULTS CARD" (desktop) and
// "03M · RESULTS — MOBILE 390" (mobile artboard).
//
// Source: aios/projects/career-player-comp/design-export/CPC-design/
//         Career Player Comp.dc.html  (lines ~337-468 desktop, ~614-721 mobile)
//
// This component is purely presentational. It takes ResultsProps from
// @/lib/types, maps every field of `comp` onto the design, and calls the
// provided callbacks. No data fetching, no global state.
//
// Inline style values are preserved verbatim from the export, converted from
// CSS strings to React style objects. Shared, design-specific classes
// (.paper-card, .tilt-card/.tilt-wrap, .stamp, .file-no, .grade .ltr/.suf,
// .cta-green, .ghost-ln) come from app/globals.css and are NOT re-expressed.
// =============================================================================

import type {
  ResultsProps,
  Badge,
  BadgeCategory,
  BadgeTier,
  Comp,
  Grades,
} from "@/lib/types";
import { useEffect, useState } from "react";
import { useTilt } from "@/lib/useTilt";
import { useIsMobile } from "@/lib/useIsMobile";

// ---- creator / B2B links (muted, scouting-doc style) ------------------------
// TODO(maurice): confirm the real creator URL before launch. Defaults to the
// LinkedIn profile; override per-deploy with NEXT_PUBLIC_CREATOR_URL.
const CREATOR_URL =
  process.env.NEXT_PUBLIC_CREATOR_URL ??
  "https://www.linkedin.com/in/mauricepeebles";
// TODO(maurice): set NEXT_PUBLIC_CONTACT_URL to the real intake (a form or a
// real inbox). Falls back to a mailto placeholder for now.
const CONTACT_URL =
  process.env.NEXT_PUBLIC_CONTACT_URL ?? "mailto:hello@careerplayercomp.com";

// ---- card-image payload (414-safe) ------------------------------------------
// The /api/card route only RENDERS: player_name, position_era, archetype_title,
// badges, card_summary, stat_line (see app/api/card/route.tsx · buildCard). The
// full comp also carries full_report (2-4 paragraphs) + other prose that the
// card never draws. Passing the whole comp via a GET ?data= param risks a 414
// URI-Too-Long on a long full_report. So we build the card URL from ONLY the
// fields the image uses — full_report and the other unrendered prose are
// dropped from the payload, which keeps the URL short and well under any limit.
// (UTF-8-safe base64url so /api/card can decode it straight off the query.)
function encodeCardComp(comp: Comp): string {
  const slim = {
    player_name: comp.player_name,
    position_era: comp.position_era,
    archetype_title: comp.archetype_title,
    ovr: comp.ovr,
    pot: comp.pot,
    badges: comp.badges,
    card_summary: comp.card_summary,
    stat_line: comp.stat_line,
    contract: comp.contract,
    draft: comp.draft,
  };
  const json = JSON.stringify(slim);
  const b64 = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    ),
  );
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---- Category color system --------------------------------------------------
// The Comp contract gives each badge a `category` (skill | temperament |
// intangible | tendency) but NOT a color. The export shows 3 color-coded chips
// drawn from the four category palette vars. We map category -> palette color
// so the chip colors are *driven by the data* rather than chip position:
//   skill       -> scoring     (burnt orange)
//   temperament -> defense     (steel blue)
//   intangible  -> culture     (ochre)
//   tendency    -> playmaking  (court green)
// (Exactly 3 badges spanning 3 categories with >=1 "tendency" per the contract,
//  so at most three of these four colors ever render at once.)
const BADGE_COLOR: Record<BadgeCategory, string> = {
  skill: "#bd5024",
  temperament: "#356287",
  intangible: "#8f7220",
  tendency: "#3a8054",
};

// Badge tier -> pip count (a 4-slot meter). Bronze 1 ... Hall of Fame 4. Shown
// as filled dots in the badge's category color so tier reads at a glance without
// fighting the category color system.
const TIER_RANK: Record<BadgeTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  "Hall of Fame": 4,
};

// ---- Grade bars are PER-USER (engine-derived) -------------------------------
// The engine now emits comp.grades (scoring/defense/playmaking/culture, A+..D),
// graded to THIS person. We keep the label + color constant (the card's fixed
// palette) and derive the letter, the +/- suffix, and the bar width from the
// grade. (Was previously a hardcoded constant identical for every user.)
const GRADE_META: Array<{ label: string; key: keyof Grades; color: string }> = [
  { label: "SCORING", key: "scoring", color: "#bd5024" },
  { label: "DEFENSE", key: "defense", color: "#356287" },
  { label: "PLAYMAKING", key: "playmaking", color: "#3a8054" },
  { label: "CULTURE", key: "culture", color: "#8f7220" },
];

// Letter grade -> bar fill width (visual only; monotonic, A+ high to F low).
const GRADE_WIDTH: Record<string, string> = {
  "A+": "96%", A: "91%", "A-": "86%", "B+": "80%", B: "74%", "B-": "68%",
  "C+": "61%", C: "54%", "C-": "48%", "D+": "41%", D: "35%", "D-": "30%", F: "24%",
};

// Split "A-" into base letter + display suffix (figure-minus for the .suf slot).
function splitGrade(raw: string): { letter: string; suffix: string } {
  const g = (raw || "B").trim().toUpperCase();
  const m = g.match(/^([A-DF])([+-])?$/);
  if (!m) return { letter: "B", suffix: "" };
  return { letter: m[1], suffix: m[2] === "-" ? "−" : m[2] ?? "" };
}

// Build the four render-ready bars from the per-user grades.
function buildGradeBars(grades: Grades | undefined) {
  return GRADE_META.map((m) => {
    const raw = grades?.[m.key] ?? "B";
    const { letter, suffix } = splitGrade(raw);
    return {
      label: m.label,
      color: m.color,
      width: GRADE_WIDTH[raw.trim().toUpperCase()] ?? "70%",
      letter,
      suffix,
    };
  });
}

// ---- stat_line display hardening --------------------------------------------
// Known engine drift (per the foundation manifest): stat_line fields can come
// back as prose. seasons/teams/pivots should print as short numerics; status as
// a short label. Tighten at display so the 4-col stat block never overflows.
function tightenNumber(raw: string): string {
  const match = raw.match(/\d+/); // first integer found, e.g. "about 11 years" -> "11"
  if (match) return match[0].padStart(2, "0"); // zero-pad to match the "03" / "02" treatment
  return raw.trim().slice(0, 3).toUpperCase();
}
function tightenStatus(raw: string): string {
  const trimmed = raw.trim();
  // Keep short labels as-is; truncate anything prose-length to a tight token.
  if (trimmed.length <= 14) return trimmed.toUpperCase();
  return trimmed.split(/\s+/).slice(0, 2).join(" ").toUpperCase();
}

// Split full_report prose into paragraphs. The contract says full_report is
// exactly 3 paragraphs as a single string. Prefer blank-line separators, but
// the model sometimes separates paragraphs with a SINGLE newline — in that case
// a naive blank-line split collapses the whole report into one block (the
// "shows as one paragraph" bug). So if blank-line splitting yields a single
// chunk but single newlines exist, fall back to splitting on those.
function toParagraphs(text: string): string[] {
  const byBlank = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  const bySingle = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (bySingle.length > 1) return bySingle;
  return text.trim() ? [text.trim()] : [];
}

// Escape user/model text for safe HTML interpolation in the printable report.
function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build a print-optimized HTML document for the "full report" download. The user
// prints it to PDF via the browser dialog (no extra dependency). Styled to read
// like the on-screen scouting case file: cream paper, green accents, hairline
// rules. Avoids background fills (browsers strip them in print) — accents are
// text color + borders, which print reliably.
function buildReportHTML(comp: Comp): string {
  const c = comp.contract;
  const yrs = c?.years
    ? /^\d+$/.test(c.years.trim())
      ? `${c.years.trim()} yrs`
      : c.years.trim()
    : "";
  const contractLine =
    [c?.value, yrs].filter(Boolean).join(" / ") +
    (c?.descriptor ? ` · ${c.descriptor}` : "");
  const draftLine =
    (comp.draft?.pick ?? "") + (comp.draft?.note ? ` · ${comp.draft.note}` : "");
  const badges = comp.badges
    .map(
      (b) =>
        `<li><strong>${esc(b.label)}</strong> <span class="tier">[${esc(
          b.tier,
        )}]</span><br><span class="muted">${esc(b.earned_by)}</span></li>`,
    )
    .join("");
  const strengths = comp.strengths?.length
    ? comp.strengths.map((s) => `<li>${esc(s)}</li>`).join("")
    : "<li class='muted'>(none listed)</li>";
  const weaknesses = comp.weaknesses?.length
    ? comp.weaknesses.map((s) => `<li>${esc(s)}</li>`).join("")
    : "<li class='muted'>(none listed)</li>";
  const seasons = comp.season_stats?.length
    ? comp.season_stats
        .map(
          (s) =>
            `<tr><td class="yr">${esc(s.year)}</td><td class="tm">${esc(
              s.team,
            )}</td><td class="ln">${esc(s.line)}</td></tr>`,
        )
        .join("")
    : "";
  const reportParas = toParagraphs(comp.full_report)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
  const seasonBlock = seasons
    ? `<h2>Career Stats by Season</h2><table class="seasons">${seasons}</table>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Scouting Report — ${esc(comp.player_name)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #2b2820; line-height: 1.55; margin: 0; }
  .doc { max-width: 720px; margin: 0 auto; padding: 8px 0 32px; }
  .top { display: flex; justify-content: space-between; align-items: center; font: 600 11px/1 'JetBrains Mono', monospace; letter-spacing: .22em; color: #2f6043; text-transform: uppercase; border-bottom: 2px solid #2f6043; padding-bottom: 10px; }
  .top .file { color: #a8a090; font-weight: 400; letter-spacing: .16em; }
  h1 { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-size: 52px; line-height: .95; text-transform: uppercase; letter-spacing: -.01em; margin: 22px 0 4px; }
  .pos { font: 500 12px 'JetBrains Mono', monospace; letter-spacing: .14em; color: #6b655a; text-transform: uppercase; }
  .arch { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-size: 24px; text-transform: uppercase; letter-spacing: .03em; color: #2f6043; margin: 6px 0 18px; }
  .ratings { display: flex; gap: 26px; align-items: baseline; border-top: 1px solid #d8d2c2; border-bottom: 1px solid #d8d2c2; padding: 12px 0; margin-bottom: 6px; }
  .ratings .n { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 700; }
  .ratings .ovr .n { font-size: 40px; color: #2f6043; }
  .ratings .pot .n { font-size: 30px; color: #2b2820; }
  .ratings .lab { font: 500 10px 'JetBrains Mono', monospace; letter-spacing: .18em; color: #6b655a; margin-left: 6px; }
  .rat-why { font-size: 12.5px; color: #4a463d; margin: 6px 0 18px; }
  .deal { display: flex; gap: 40px; font: 500 13px 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
  .deal .k { color: #a8a090; font-size: 10px; letter-spacing: .16em; display: block; margin-bottom: 3px; }
  h2 { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .24em; color: #2f6043; text-transform: uppercase; border-bottom: 1px solid #d8d2c2; padding-bottom: 6px; margin: 26px 0 12px; }
  p { margin: 0 0 12px; font-size: 14px; }
  .quote { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-size: 22px; color: #2f6043; text-transform: uppercase; line-height: 1.25; }
  .grades { font: 500 13px 'JetBrains Mono', monospace; letter-spacing: .04em; }
  ul { margin: 0; padding-left: 18px; } li { margin-bottom: 7px; font-size: 13.5px; }
  .cols { display: flex; gap: 40px; } .cols > div { flex: 1; }
  .tier { font: 500 11px 'JetBrains Mono', monospace; color: #bd5024; letter-spacing: .06em; }
  .muted { color: #6b655a; } .colhead { color: #2f6043; }
  table.seasons { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.seasons td { padding: 8px 8px 8px 0; border-bottom: 1px solid #ece6d6; vertical-align: top; }
  table.seasons .yr { font: 500 11px 'JetBrains Mono', monospace; color: #2f6043; white-space: nowrap; width: 92px; }
  table.seasons .tm { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; text-transform: uppercase; font-size: 14px; width: 160px; }
  .foot { margin-top: 30px; padding-top: 12px; border-top: 1px solid #d8d2c2; font: 400 10px 'JetBrains Mono', monospace; letter-spacing: .12em; color: #a8a090; text-transform: uppercase; }
</style></head>
<body><div class="doc">
  <div class="top"><span>Career Player Comp · Scouting Report</span><span class="file">File No. 2026-4471</span></div>
  <h1>${esc(comp.player_name)}</h1>
  <div class="pos">${esc(comp.position_era)}</div>
  <div class="arch">${esc(comp.archetype_title)}</div>
  <div class="ratings">
    <span class="ovr"><span class="n">${comp.ovr}</span><span class="lab">OVR</span></span>
    <span class="pot"><span class="n">${comp.pot}</span><span class="lab">POT</span></span>
  </div>
  <div class="rat-why">${esc(comp.ovr_rationale)}</div>
  <div class="deal">
    <span><span class="k">Contract</span>${esc(contractLine)}</span>
    <span><span class="k">Draft</span>${esc(draftLine)}</span>
  </div>
  <h2>Why This Player</h2><p>${esc(comp.why_this_player)}</p>
  <h2>Standout Line</h2><p class="quote">“${esc(comp.screenshot_line)}”</p>
  <h2>Scout's Summary</h2><p>${esc(comp.card_summary)}</p>
  <h2>Grades</h2><p class="grades">SCORING ${esc(comp.grades.scoring)} &nbsp; DEFENSE ${esc(comp.grades.defense)} &nbsp; PLAYMAKING ${esc(comp.grades.playmaking)} &nbsp; CULTURE ${esc(comp.grades.culture)}</p>
  <h2>Badges</h2><ul>${badges}</ul>
  <h2>Strengths &amp; Weaknesses</h2>
  <div class="cols">
    <div><p class="grades colhead">STRENGTHS</p><ul>${strengths}</ul></div>
    <div><p class="grades colhead">WEAKNESSES</p><ul>${weaknesses}</ul></div>
  </div>
  ${seasonBlock}
  <h2>Full Scouting Report</h2>${reportParas}
  <h2>Front Office Fit</h2><p>${esc(comp.front_office_fit)}</p>
  <div class="foot">careerplayercomp.com · scouted by Claude S. (AI) · For entertainment. Not affiliated with the NBA, WNBA, or any player.</div>
</div></body></html>`;
}

export default function Results({
  comp,
  onAppeal,
  onHome,
  tipUrl,
  scoutedNumber,
}: ResultsProps) {
  // Match the desktop vs 390px mobile artboard with one component, flipping live
  // across the shared 768px breakpoint (see @/lib/useIsMobile).
  const isMobile = useIsMobile();
  // After Share fires, the tip copy softens from the long pitch to the short
  // post-share line (mirrors the export's data-tip-target / .tip-soft swap).
  const [shared, setShared] = useState(false);
  // Desktop clipboard fallback feedback: swap the Share label to "Link copied ✓"
  // for a beat (the copy is otherwise invisible to the user).
  const [copied, setCopied] = useState(false);

  const badges = comp.badges.slice(0, 3);
  const reportParagraphs = toParagraphs(comp.full_report);
  const stat = {
    seasons: tightenNumber(comp.stat_line.seasons),
    teams: tightenNumber(comp.stat_line.teams),
    pivots: tightenNumber(comp.stat_line.pivots),
    status: tightenStatus(comp.stat_line.contract_status),
  };

  // Build the card-image URLs from the SLIM payload (see encodeCardComp), never
  // the full comp, so a long full_report can't 414 the GET.
  // STORY (tall) is what users download/share as a file — it fits the full card
  // (badges, contract, draft) without the feed's 1200x630 overflow. FEED (wide)
  // is only the OG/link-preview image when sharing the URL itself.
  const slim = encodeCardComp(comp);
  const cardUrlStory = `/api/card?format=story&data=${slim}`;
  const cardUrlFeed = `/api/card?format=feed&data=${slim}`;
  const slugBase = comp.player_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fileName = `scouting-report-${slugBase}.png`;

  // Fetch the rendered PNG as a blob and trigger a real browser download.
  const downloadCardPng = async () => {
    const res = await fetch(cardUrlStory);
    if (!res.ok) throw new Error(`card fetch failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  // The full scouting report as a PDF: render a print-optimized HTML doc into a
  // hidden iframe and open the browser print dialog (the user picks "Save as
  // PDF"). No extra dependency, and the layout is fully controlled.
  const downloadReportPdf = () => {
    const html = buildReportHTML(comp);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) {
      iframe.remove();
      return;
    }
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };
    win.onafterprint = cleanup;
    doc.open();
    doc.write(html);
    doc.close();
    // Give layout/fonts a beat, then print. Fallback cleanup if onafterprint
    // never fires (some browsers).
    const fire = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* ignore */
      }
      setTimeout(cleanup, 60_000);
    };
    if (doc.readyState === "complete") setTimeout(fire, 350);
    else iframe.onload = () => setTimeout(fire, 350);
  };

  const downloadBoth = async () => {
    setShared(true);
    try {
      await downloadCardPng();
    } catch {
      /* card failed; still offer the report */
    }
    downloadReportPdf();
  };

  // Native share with graceful fallback. Prefer sharing the PNG file itself
  // (Web Share Level 2); fall back to sharing the card URL; then to copying the
  // link; then to a direct download. The soft post-share tip shows either way.
  const handleShare = async () => {
    setShared(true);
    const navAny = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    const shareText = comp.screenshot_line;
    const shareTitle = `Career Player Comp — ${comp.player_name}`;

    // 1) Try sharing the actual PNG file (best result on mobile) — the tall
    //    story card, which fits the whole card without the feed's overflow.
    if (navAny.share) {
      try {
        const res = await fetch(cardUrlStory);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: "image/png" });
          if (!navAny.canShare || navAny.canShare({ files: [file] })) {
            await navAny.share({ title: shareTitle, text: shareText, files: [file] });
            return;
          }
        }
      } catch (err) {
        // User dismissed the share sheet: done — don't open a second one.
        if (err instanceof Error && err.name === "AbortError") return;
        // file share unsupported — try URL share next
      }
      // 2) Share the absolute card URL as a link (feed = the wide OG preview).
      try {
        await navAny.share({
          title: shareTitle,
          text: shareText,
          url: new URL(cardUrlFeed, window.location.origin).toString(),
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // failed — fall through to copy/download
      }
    }

    // 3) No Web Share API: copy the link, else download the PNG.
    const absolute = new URL(cardUrlFeed, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolute);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // clipboard blocked — fall through to download
    }
    try {
      await downloadCardPng();
    } catch {
      window.open(absolute, "_blank", "noopener");
    }
  };

  const handleDownload = async () => {
    setShared(true);
    try {
      await downloadCardPng();
    } catch {
      // If the blob fetch fails, open the card URL directly as a last resort.
      window.open(
        new URL(cardUrlStory, window.location.origin).toString(),
        "_blank",
        "noopener",
      );
    }
  };

  const onAppealClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onAppeal();
  };

  return isMobile
    ? renderMobile()
    : renderDesktop();

  // ---------------------------------------------------------------------------
  // DESKTOP — export Screen 03 (lines ~337-468)
  // ---------------------------------------------------------------------------
  function renderDesktop() {
    return (
      <div className="paper-bg" style={{ minHeight: "100vh", overflowX: "hidden" }}>
        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 56px",
          }}
        >
          <button
            type="button"
            onClick={onHome}
            aria-label="Career Player Comp — home"
            className="cpc-home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <div style={{ width: 8, height: 8, background: "#2f6043" }} />
            <div
              style={{
                font: "600 13px 'Barlow Condensed'",
                letterSpacing: "0.22em",
                color: "#211e17",
              }}
            >
              CAREER PLAYER COMP
            </div>
          </button>
          <div
            style={{
              font: "400 11px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.18em",
            }}
          >
            [ REPORT FILED ]
          </div>
        </div>

        {/* two-column body */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 64,
            padding: "64px 56px",
            maxWidth: 1480,
            margin: "0 auto",
          }}
        >
          {/* LEFT: hero tilt card + standout line */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 30,
            }}
          >
            <CardTilt comp={comp} badges={badges} stat={stat} />
            {/* standout line / pull quote = screenshot_line */}
            <div style={{ maxWidth: 560, textAlign: "center" }}>
              <div
                style={{
                  font: "600 27px/1.32 'Barlow Condensed'",
                  color: "#2f6043",
                  textTransform: "uppercase",
                  letterSpacing: "0.01em",
                }}
              >
                {`“${comp.screenshot_line}”`}
              </div>
              <div
                style={{
                  font: "400 10px 'JetBrains Mono', monospace",
                  color: "#a8a090",
                  letterSpacing: "0.2em",
                  marginTop: 12,
                }}
              >
                [ STANDOUT LINE ]
              </div>
            </div>
          </div>

          {/* RIGHT: scout's typed annotation */}
          <div style={{ paddingTop: 54, maxWidth: 400 }}>
            <div
              style={{
                font: "500 10px 'JetBrains Mono', monospace",
                color: "#2f6043",
                letterSpacing: "0.24em",
                marginBottom: 14,
              }}
            >
              [ SCOUT'S NOTE · FINAL ]
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(47,96,67,0.32)",
                marginBottom: 24,
              }}
            />
            {/* headline: the why-this-player parallel, as the scout's verdict.
                Dialed down again (32 -> 27px) and lightened (700 -> 600) so the
                right column reads as supporting detail under the hero card and
                the full report below, not a second headline. */}
            <h2
              style={{
                font: "600 27px/1.08 'Barlow Condensed'",
                color: "#211e17",
                textTransform: "uppercase",
                letterSpacing: "-0.005em",
                margin: "0 0 20px",
              }}
            >
              {comp.why_this_player}
            </h2>
            {/* prose para 1 = card_summary (the on-card summary, echoed here).
                Annotation prose dropped another step (13 -> 12px) so the column
                sits below the full report in the reading hierarchy. */}
            <p
              style={{
                font: "400 12px/1.65 'Inter'",
                color: "#4a463d",
                margin: "0 0 30px",
              }}
            >
              <span style={{ fontStyle: "italic", color: "#6b655a" }}>
                In summary,{" "}
              </span>
              {comp.card_summary}
            </p>
            {/* Best Team Fit moved to its own wide section below (DepthSection). */}

            {/* grade bars (per-user; see buildGradeBars) */}
            <div style={{ borderTop: "1px solid rgba(33,30,23,0.14)" }}>
              {buildGradeBars(comp.grades).map((g, i, arr) => (
                <div
                  key={g.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 44px",
                    gap: 18,
                    padding: "16px 0",
                    borderBottom:
                      i < arr.length - 1
                        ? "1px solid rgba(33,30,23,0.08)"
                        : "none",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      font: "500 11px 'JetBrains Mono', monospace",
                      color: g.color,
                      letterSpacing: "0.18em",
                    }}
                  >
                    {g.label}
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "rgba(33,30,23,0.08)",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{ height: "100%", width: g.width, background: g.color }}
                    />
                  </div>
                  <div className="grade">
                    <span className="ltr" style={{ fontSize: 28, color: g.color }}>
                      {g.letter}
                    </span>
                    <span
                      className="suf"
                      style={{ fontSize: 18, width: 12, color: g.color }}
                    >
                      {g.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* OVR/POT rationale + how-scored note (the trust block) */}
            <RatingNote comp={comp} />

            {/* scout signature */}
            <div
              style={{
                marginTop: 30,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div
                  style={{
                    font: "600 16px 'Barlow Condensed'",
                    color: "#211e17",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Claude S.
                </div>
                <div
                  style={{
                    font: "400 9.5px 'JetBrains Mono', monospace",
                    color: "#a8a090",
                    letterSpacing: "0.2em",
                    marginTop: 3,
                  }}
                >
                  [ AI SCOUT · 10,000+ CAREERS READ ]
                </div>
              </div>
              <div
                style={{
                  font: "500 10px 'JetBrains Mono', monospace",
                  color: "#2f6043",
                  letterSpacing: "0.22em",
                  opacity: 0.7,
                  transform: "rotate(-2.5deg)",
                  border: "1px solid rgba(47,96,67,0.45)",
                  padding: "4px 7px",
                  borderRadius: 2,
                }}
              >
                CS
              </div>
            </div>

            {/* Share + Download */}
            <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
              <button
                type="button"
                className="cta-green"
                onClick={handleShare}
                style={{
                  background: "#2f6043",
                  color: "#f1ece0",
                  border: "none",
                  padding: "16px 22px",
                  font: "600 13px 'Inter'",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  borderRadius: 4,
                  flex: 1,
                }}
              >
                {copied ? "Link copied ✓" : <>Share Report &nbsp;&rarr;</>}
              </button>
              <button
                type="button"
                className="ghost-ln"
                onClick={handleDownload}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(33,30,23,0.2)",
                  color: "#211e17",
                  padding: "16px 22px",
                  font: "600 13px 'Inter'",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  borderRadius: 4,
                }}
              >
                Download
              </button>
            </div>
            <div
              style={{
                font: "400 12px/1.5 'Inter'",
                color: "#6b655a",
                marginTop: 12,
              }}
            >
              The Download button saves the card. You can also grab the{" "}
              <DownloadLink onClick={downloadReportPdf}>full report</DownloadLink>{" "}
              or <DownloadLink onClick={downloadBoth}>card + report</DownloadLink>.
            </div>
            <div
              style={{
                font: "400 12.5px/1.5 'Inter'",
                color: "#6b655a",
                marginTop: 10,
              }}
            >
              Tip: take a screenshot before you close. We don't keep a copy.
            </div>

            {/* tip block — primary pitch swaps to soft post-share copy */}
            <div
              style={{
                marginTop: 20,
                padding: "20px 22px",
                background: "#f4eede",
                border: "1px solid rgba(33,30,23,0.18)",
                borderRadius: 4,
              }}
            >
              {shared ? (
                <div>
                  <div
                    style={{
                      font: "400 13px/1.65 'Inter'",
                      color: "#4a463d",
                      marginBottom: 14,
                    }}
                  >
                    Glad it landed. Tip your scout if it earned it.
                  </div>
                  <TipLink url={tipUrl} fontSize={11} letterSpacing="0.18em" />
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      font: "400 13px/1.65 'Inter'",
                      color: "#4a463d",
                      marginBottom: 14,
                    }}
                  >
                    Real talk from the scouting department: this runs on AI that
                    costs actual money, and the front office is one guy with a
                    family and a server bill that keeps climbing. No ads, no
                    account, nothing saved. If the scout read you right, tip your
                    scout.
                  </div>
                  <TipLink url={tipUrl} fontSize={11} letterSpacing="0.18em" />
                </div>
              )}
            </div>

            {/* appeal + file footer */}
            <div
              style={{
                marginTop: 22,
                paddingTop: 16,
                borderTop: "1px solid rgba(33,30,23,0.12)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <a
                href="#"
                onClick={onAppealClick}
                style={{
                  font: "500 11px 'JetBrains Mono', monospace",
                  color: "#2f6043",
                  letterSpacing: "0.2em",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(47,96,67,0.45)",
                  paddingBottom: 2,
                }}
              >
                [ APPEAL THIS REPORT &rarr; ]
              </a>
              <div
                style={{
                  font: "400 10px 'JetBrains Mono', monospace",
                  color: "#a8a090",
                  letterSpacing: "0.18em",
                }}
              >
                FILE No. 2026-4471
              </div>
            </div>

            {/* creator credit + quiet B2B line (muted, scouting-doc style) */}
            <CreatorCredit />
          </div>
        </div>

        {/* STRENGTHS/WEAKNESSES + CAREER STATS BY SEASON (Tier 2 depth) */}
        <DepthSection comp={comp} scoutedNumber={scoutedNumber} />

        {/* FULL SCOUTING REPORT */}
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "8px 56px 80px" }}>
          <div
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#2f6043",
              letterSpacing: "0.24em",
              marginBottom: 14,
            }}
          >
            [ FULL SCOUTING REPORT ]
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(47,96,67,0.32)",
              marginBottom: 28,
            }}
          />
          {reportParagraphs.map((para, i) => (
            <p
              key={i}
              style={{
                // Full-report body scaled UP (13 -> 16px) — this is the meat of
                // the report and should be the most readable block on the page.
                font: "400 16px/1.72 'Inter'",
                color: "#4a463d",
                margin: "0 0 22px",
              }}
            >
              {para}
            </p>
          ))}
          <div
            style={{
              marginTop: 24,
              font: "400 11px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.18em",
            }}
          >
            [ END OF REPORT · FILE No. 2026-4471 · CLAUDE S. ]
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MOBILE — export Screen 03M (lines ~614-721)
  // ---------------------------------------------------------------------------
  function renderMobile() {
    return (
      <div className="paper-bg" style={{ minHeight: "100vh", overflowX: "hidden" }}>
        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
          }}
        >
          <button
            type="button"
            onClick={onHome}
            aria-label="Career Player Comp — home"
            className="cpc-home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <div style={{ width: 6, height: 6, background: "#2f6043" }} />
            <div
              style={{
                font: "600 11px 'Barlow Condensed'",
                letterSpacing: "0.22em",
              }}
            >
              CAREER PLAYER COMP
            </div>
          </button>
          <div
            style={{
              font: "400 9px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.16em",
            }}
          >
            [ REPORT FILED ]
          </div>
        </div>

        {/* hero tilt card — FIRST on mobile (card before the scout's words) */}
        <CardTilt comp={comp} badges={badges} stat={stat} mobile />

        {/* standout line / pull quote = screenshot_line */}
        <div style={{ padding: "0 22px 4px", textAlign: "center" }}>
          <div
            style={{
              font: "600 19px/1.3 'Barlow Condensed'",
              color: "#2f6043",
              textTransform: "uppercase",
              letterSpacing: "0.01em",
            }}
          >
            {`“${comp.screenshot_line}”`}
          </div>
          <div
            style={{
              font: "400 9px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.2em",
              marginTop: 8,
            }}
          >
            [ STANDOUT LINE ]
          </div>
        </div>

        {/* scout's note — BELOW the card on mobile (card-first order).
            Headline scaled DOWN (30 -> 25px) and lightened (700 -> 600) to
            mirror desktop; the on-card summary echoes here as the verdict prose. */}
        <div style={{ padding: "26px 22px 4px" }}>
          <div
            style={{
              font: "400 10px 'JetBrains Mono', monospace",
              color: "#2f6043",
              letterSpacing: "0.28em",
              marginBottom: 10,
            }}
          >
            [ SCOUT'S NOTE · FINAL ]
          </div>
          <h2
            style={{
              font: "600 25px/1.06 'Barlow Condensed'",
              textTransform: "uppercase",
              letterSpacing: "-0.005em",
              margin: "0 0 12px",
            }}
          >
            {comp.why_this_player}
          </h2>
          <p
            style={{
              font: "400 12px/1.6 'Inter'",
              color: "#4a463d",
              margin: 0,
            }}
          >
            <span style={{ fontStyle: "italic", color: "#6b655a" }}>
              In summary,{" "}
            </span>
            {comp.card_summary}
          </p>
        </div>

        {/* grade bars (per-user; see buildGradeBars) */}
        <div style={{ padding: "14px 22px 0" }}>
          <div style={{ borderTop: "1px solid rgba(33,30,23,0.14)" }}>
            {buildGradeBars(comp.grades).map((g, i, arr) => (
              <div
                key={g.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 34px",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom:
                    i < arr.length - 1
                      ? "1px solid rgba(33,30,23,0.08)"
                      : "none",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    font: "500 10px 'JetBrains Mono', monospace",
                    color: g.color,
                    letterSpacing: "0.16em",
                  }}
                >
                  {g.label}
                </div>
                <div
                  style={{
                    height: 5,
                    background: "rgba(33,30,23,0.08)",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{ height: "100%", width: g.width, background: g.color }}
                  />
                </div>
                <div className="grade">
                  <span className="ltr" style={{ fontSize: 22, color: g.color }}>
                    {g.letter}
                  </span>
                  <span
                    className="suf"
                    style={{ fontSize: 14, width: 10, color: g.color }}
                  >
                    {g.suffix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OVR/POT rationale + how-scored note (the trust block) */}
        <div style={{ padding: "0 22px" }}>
          <RatingNote comp={comp} mobile />
        </div>

        {/* Share + Download (stacked on mobile) */}
        <div
          style={{
            padding: "20px 22px 0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="cta-green"
            onClick={handleShare}
            style={{
              background: "#2f6043",
              color: "#f1ece0",
              border: "none",
              padding: 16,
              font: "600 12px 'Inter'",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderRadius: 4,
              width: "100%",
            }}
          >
            {copied ? "Link copied ✓" : <>Share Report &nbsp;&rarr;</>}
          </button>
          <button
            type="button"
            className="ghost-ln"
            onClick={handleDownload}
            style={{
              background: "transparent",
              border: "1px solid rgba(33,30,23,0.2)",
              color: "#211e17",
              padding: 16,
              font: "600 12px 'Inter'",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderRadius: 4,
              width: "100%",
            }}
          >
            Download PNG
          </button>
        </div>
        <div
          style={{
            padding: "14px 22px 0",
            font: "400 12px/1.5 'Inter'",
            color: "#6b655a",
          }}
        >
          The button above saves the card. You can also grab the{" "}
          <DownloadLink onClick={downloadReportPdf}>full report</DownloadLink> or{" "}
          <DownloadLink onClick={downloadBoth}>card + report</DownloadLink>.
        </div>
        <div
          style={{
            padding: "10px 22px 0",
            font: "400 12px/1.5 'Inter'",
            color: "#6b655a",
          }}
        >
          Tip: take a screenshot before you close the tab. We don't keep a copy.
        </div>

        {/* tip block */}
        <div
          style={{
            margin: "16px 22px 0",
            padding: "16px 18px",
            background: "#f4eede",
            border: "1px solid rgba(33,30,23,0.18)",
            borderRadius: 4,
          }}
        >
          {shared ? (
            <div>
              <div
                style={{
                  font: "400 12.5px/1.6 'Inter'",
                  color: "#4a463d",
                  marginBottom: 12,
                }}
              >
                Glad it landed. Tip your scout if it earned it.
              </div>
              <TipLink url={tipUrl} fontSize={10} letterSpacing="0.16em" />
            </div>
          ) : (
            <div>
              <div
                style={{
                  font: "400 12.5px/1.6 'Inter'",
                  color: "#4a463d",
                  marginBottom: 12,
                }}
              >
                Real talk from the scouting department: this runs on AI that costs
                actual money, and the front office is one guy with a family and a
                server bill that keeps climbing. No ads, no account, nothing
                saved. If the scout read you right, tip your scout.
              </div>
              <TipLink url={tipUrl} fontSize={10} letterSpacing="0.16em" />
            </div>
          )}
        </div>

        {/* STRENGTHS/WEAKNESSES + CAREER STATS BY SEASON (Tier 2 depth) */}
        <DepthSection comp={comp} mobile scoutedNumber={scoutedNumber} />

        {/* FULL SCOUTING REPORT */}
        <div style={{ padding: "24px 22px 0" }}>
          <div
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#2f6043",
              letterSpacing: "0.22em",
              marginBottom: 12,
            }}
          >
            [ FULL SCOUTING REPORT ]
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(47,96,67,0.3)",
              marginBottom: 18,
            }}
          />
          {reportParagraphs.map((para, i) => (
            <p
              key={i}
              style={{
                // Full-report body scaled UP (13.5 -> 16px) — the meat of the
                // report, the most readable block on the page.
                font: "400 16px/1.72 'Inter'",
                color: "#4a463d",
                margin: "0 0 18px",
              }}
            >
              {para}
            </p>
          ))}
          <div
            style={{
              font: "400 10px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.18em",
            }}
          >
            [ END OF REPORT · FILE No. 2026-4471 ]
          </div>
        </div>

        {/* appeal + file footer */}
        <div
          style={{
            margin: "24px 22px 22px",
            borderTop: "1px solid rgba(33,30,23,0.12)",
            paddingTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <a
            href="#"
            onClick={onAppealClick}
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#2f6043",
              letterSpacing: "0.18em",
              textDecoration: "none",
              borderBottom: "1px solid rgba(47,96,67,0.45)",
              paddingBottom: 2,
            }}
          >
            [ APPEAL REPORT &rarr; ]
          </a>
          <div
            style={{
              font: "400 9px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.18em",
            }}
          >
            FILE No. 2026-4471
          </div>
        </div>

        {/* creator credit + quiet B2B line (muted, scouting-doc style) */}
        <div style={{ margin: "0 22px 28px" }}>
          <CreatorCredit />
        </div>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// The hero tilt paper-card. Pointer- and touch-driven 3D tilt via useTilt;
// the on-screen card keeps the grain/tilt/noise the satori card route can't
// render. `mobile` toggles the smaller artboard's font sizes/padding.
// Module scope on purpose: declared inside Results it was re-created on every
// render, so any parent state change (e.g. Share/Download flipping `shared`)
// remounted it and replayed the OVR count-up + intro tilt.
// ---------------------------------------------------------------------------
function CardTilt({
  comp,
  badges,
  stat,
  mobile = false,
}: {
  comp: Comp;
  badges: Badge[];
  stat: { seasons: string; teams: string; pivots: string; status: string };
  mobile?: boolean;
}) {
  // Pointer + touch tilt, reduced-motion-aware. The resting lean
  // (rotateX(-5deg) rotateY(8deg)) and the eased snap-back live in .tilt-card.
  const { wrapRef, cardRef } = useTilt();

  // OVR count-up reveal: the hero number ticks 0 -> comp.ovr on mount (the 2K
  // "player reveal" beat). Reduced-motion users get the final number instantly.
  // The satori download card always uses the static comp.ovr, so this is purely
  // on-screen and never affects the saved image.
  const [shownOvr, setShownOvr] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShownOvr(comp.ovr);
      return;
    }
    let raf = 0;
    let start = 0;
    const dur = 1000;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setShownOvr(Math.round(eased * comp.ovr));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Contract display: "$142M · 4 YRS" on the value line, descriptor as the note.
  const c = comp.contract ?? { value: "", years: "", descriptor: "" };
  const yrs = c.years
    ? /^\d+$/.test(c.years.trim())
      ? `${c.years.trim()} YRS`
      : c.years.trim().toUpperCase()
    : "";
  const contractValue = [c.value, yrs].filter(Boolean).join(" · ");
  const contractNote = c.descriptor ?? "";

  return (
    <div
      className="tilt-wrap"
      ref={wrapRef}
      style={
        mobile
          ? { padding: "16px 22px 22px" }
          : { display: "flex", justifyContent: "center", alignItems: "flex-start" }
      }
    >
      <div
        ref={cardRef}
        className="tilt-card paper-card"
        style={mobile ? { padding: "26px 22px" } : { width: 580, padding: "44px 42px" }}
      >
        <div className="stamp" style={mobile ? { top: 12, right: 12 } : undefined}>
          <span className="dept">SCOUTING DEPT.</span>
          <span className="cls">{mobile ? "CLASS A" : "CLASS A · CONFIDENTIAL"}</span>
        </div>

        <div
          className="layer-z1"
          style={{
            font: mobile
              ? "500 9px 'JetBrains Mono', monospace"
              : "500 10px 'JetBrains Mono', monospace",
            letterSpacing: mobile ? "0.2em" : "0.22em",
            color: "#6b655a",
            marginBottom: mobile ? 12 : 14,
          }}
        >
          [ SCOUTING REPORT ]
        </div>

        <div
          className="layer-z1 file-no"
          style={mobile ? { marginBottom: 16, fontSize: 9 } : { marginBottom: 22 }}
        >
          FILE No. 2026-4471
        </div>

        {/* player_name + OVR/POT hero badge (2K-style overall rating) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: mobile ? 12 : 20,
            marginBottom: mobile ? 8 : 10,
          }}
        >
          <div
            className="layer-z3"
            style={{
              font: mobile
                ? "700 44px/0.92 'Barlow Condensed'"
                : "700 76px/0.92 'Barlow Condensed'",
              color: "#211e17",
              textTransform: "uppercase",
              letterSpacing: "-0.008em",
              flex: 1,
              minWidth: 0,
            }}
          >
            {comp.player_name}
          </div>
          <div
            className="layer-z3"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                font: mobile
                  ? "700 42px/0.86 'Barlow Condensed'"
                  : "700 68px/0.86 'Barlow Condensed'",
                color: "#2f6043",
                letterSpacing: "-0.01em",
              }}
            >
              {shownOvr}
            </div>
            <div
              style={{
                font: mobile
                  ? "500 9px 'JetBrains Mono', monospace"
                  : "500 11px 'JetBrains Mono', monospace",
                color: "#6b655a",
                letterSpacing: "0.24em",
                marginTop: mobile ? 1 : 2,
              }}
            >
              OVR
            </div>
            <div
              style={{
                font: mobile
                  ? "500 8px 'JetBrains Mono', monospace"
                  : "500 10px 'JetBrains Mono', monospace",
                color: "#a8a090",
                letterSpacing: "0.14em",
                marginTop: mobile ? 3 : 5,
              }}
            >
              POT {comp.pot}
            </div>
          </div>
        </div>

        {/* position_era */}
        <div
          className="layer-z2"
          style={{
            font: mobile
              ? "500 10px 'JetBrains Mono', monospace"
              : "500 12px 'JetBrains Mono', monospace",
            color: "#6b655a",
            letterSpacing: "0.16em",
            marginBottom: mobile ? 14 : 26,
          }}
        >
          {comp.position_era}
        </div>

        {/* archetype_title */}
        <div
          className="layer-z2"
          style={{
            font: mobile
              ? "600 17px 'Barlow Condensed'"
              : "600 26px 'Barlow Condensed'",
            color: "#2f6043",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: mobile ? 14 : 22,
          }}
        >
          {comp.archetype_title}
        </div>

        <div
          style={{
            height: 1,
            background: "rgba(47,96,67,0.32)",
            marginBottom: mobile ? 14 : 24,
          }}
        />

        {/* badges — color-coded by category (see BADGE_COLOR) */}
        <div
          className="layer-z3"
          style={{
            display: "flex",
            gap: mobile ? 5 : 8,
            marginBottom: mobile ? 16 : 26,
            flexWrap: "wrap",
          }}
        >
          {badges.map((b: Badge, i) => {
            const c = BADGE_COLOR[b.category];
            const rank = TIER_RANK[b.tier] ?? 2;
            return (
              <span
                key={i}
                title={`${b.tier} · ${b.earned_by}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: mobile ? 5 : 6,
                  font: mobile
                    ? "500 9px 'JetBrains Mono', monospace"
                    : "500 11px 'JetBrains Mono', monospace",
                  letterSpacing: mobile ? "0.14em" : "0.16em",
                  padding: mobile ? "5px 8px" : "7px 11px",
                  background: mobile ? undefined : `${c}0f`, // ~6% tint on desktop
                  border: `1px solid ${c}`,
                  color: c,
                  borderRadius: 3,
                  textTransform: "uppercase",
                }}
              >
                {b.label}
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[0, 1, 2, 3].map((p) => (
                    <span
                      key={p}
                      style={{
                        width: mobile ? 3 : 4,
                        height: mobile ? 3 : 4,
                        borderRadius: "50%",
                        background: p < rank ? c : "transparent",
                        border: `1px solid ${c}`,
                        opacity: p < rank ? 1 : 0.35,
                      }}
                    />
                  ))}
                </span>
              </span>
            );
          })}
        </div>

        {/* card_summary — prints ON the card (desktop only, per export) */}
        {!mobile && (
          <>
            <div
              className="layer-z1"
              style={{
                font: "400 14px/1.6 'Inter'",
                color: "#4a463d",
                marginBottom: 26,
              }}
            >
              {comp.card_summary}
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(33,30,23,0.12)",
                marginBottom: 20,
              }}
            />
          </>
        )}
        {mobile && (
          <>
            <div
              className="layer-z1"
              style={{
                font: "400 12.5px/1.6 'Inter'",
                color: "#4a463d",
                marginBottom: 16,
              }}
            >
              {comp.card_summary}
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(33,30,23,0.12)",
                marginBottom: 12,
              }}
            />
          </>
        )}

        {/* stat_line — 4 cols: SEASONS / TEAMS / PIVOTS / STATUS */}
        <div
          className="layer-z2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: mobile ? 8 : 14,
          }}
        >
          <StatCell label={mobile ? "SEAS" : "SEASONS"} value={stat.seasons} mobile={mobile} />
          <StatCell label="TEAMS" value={stat.teams} mobile={mobile} />
          <StatCell label="PIVOTS" value={stat.pivots} mobile={mobile} />
          <StatCell label="STATUS" value={stat.status} mobile={mobile} accent />
        </div>

        {/* contract value + draft slot (Tier 1 on-card enrichment) */}
        {(comp.contract?.value || comp.draft?.pick) && (
          <div
            className="layer-z2"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: mobile ? 8 : 14,
              marginTop: mobile ? 12 : 16,
              paddingTop: mobile ? 12 : 16,
              borderTop: "1px solid rgba(33,30,23,0.1)",
            }}
          >
            <DealCell
              label="CONTRACT"
              value={contractValue}
              note={contractNote}
              mobile={mobile}
            />
            <DealCell
              label="DRAFT"
              value={comp.draft?.pick ?? ""}
              note={comp.draft?.note ?? ""}
              mobile={mobile}
              accent
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- small presentational helpers -------------------------------------------

// Muted creator credit + a quiet B2B line, styled to read like the bottom of a
// scouting document, not a marketing CTA. Used on both desktop and mobile.
function CreatorCredit() {
  const linkBase: React.CSSProperties = {
    color: "#6b655a",
    textDecoration: "none",
    borderBottom: "1px solid rgba(33,30,23,0.18)",
    paddingBottom: 1,
  };
  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 14,
        borderTop: "1px solid rgba(33,30,23,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          font: "400 10px 'JetBrains Mono', monospace",
          color: "#a8a090",
          letterSpacing: "0.16em",
        }}
      >
        BUILT BY{" "}
        <a
          href={CREATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={linkBase}
        >
          MAURICE PEEBLES
        </a>
      </div>
      <div
        style={{
          font: "400 11px/1.5 'Inter'",
          color: "#a8a090",
        }}
      >
        Want this for your team or brand?{" "}
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={linkBase}
        >
          Get in touch.
        </a>
      </div>
    </div>
  );
}

// The rating trust block: the OVR/POT readout, the per-user rationale (so the
// number reads as earned, not arbitrary), and a static one-line note on what
// the rating weighs (so nobody feels cheated by a low number). Results page
// only — the card itself carries the big OVR; this is the on-screen depth.
function RatingNote({ comp, mobile = false }: { comp: Comp; mobile?: boolean }) {
  return (
    <div
      style={{
        marginTop: mobile ? 22 : 30,
        paddingTop: mobile ? 16 : 18,
        borderTop: "1px solid rgba(33,30,23,0.14)",
      }}
    >
      <div
        style={{
          font: "500 10px 'JetBrains Mono', monospace",
          color: "#2f6043",
          letterSpacing: "0.24em",
          marginBottom: 12,
        }}
      >
        [ THE RATING ]
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              font: mobile
                ? "700 30px 'Barlow Condensed'"
                : "700 34px 'Barlow Condensed'",
              color: "#2f6043",
            }}
          >
            {comp.ovr}
          </span>
          <span
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#6b655a",
              letterSpacing: "0.18em",
            }}
          >
            OVR
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              font: mobile
                ? "700 22px 'Barlow Condensed'"
                : "700 24px 'Barlow Condensed'",
              color: "#211e17",
            }}
          >
            {comp.pot}
          </span>
          <span
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#a8a090",
              letterSpacing: "0.18em",
            }}
          >
            POT
          </span>
        </div>
      </div>
      <p
        style={{
          font: mobile ? "400 12.5px/1.6 'Inter'" : "400 13px/1.65 'Inter'",
          color: "#4a463d",
          margin: "0 0 10px",
        }}
      >
        {comp.ovr_rationale}
      </p>
      <p
        style={{
          font: "400 11px/1.55 'Inter'",
          color: "#a8a090",
          margin: 0,
        }}
      >
        OVR weighs career mastery, longevity, trajectory, impact, and how hard
        your game is to replace, not pay or title. POT is your ceiling.
      </p>
    </div>
  );
}

// A small inline text button styled like a scouting-doc link (green underline),
// used for the secondary download options (full report / card + report).
function DownloadLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "#2f6043",
        textDecoration: "none",
        borderBottom: "1px solid rgba(47,96,67,0.5)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Format a number as an English ordinal with thousands separators, e.g. 1848 ->
// "1,848th" (for the "you're the Nth career scouted" social-proof line).
function ordinal(n: number): string {
  const v = n % 100;
  const suffix =
    v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n.toLocaleString("en-US")}${suffix}`;
}

// Tier 2 results-page depth: strengths/weaknesses (2K pros/cons) + the career
// "stats by season" table. Renders nothing if the engine returned neither (e.g.
// a résumé too thin to build season rows). One shared block for desktop+mobile.
function DepthSection({
  comp,
  mobile = false,
  scoutedNumber,
}: {
  comp: Comp;
  mobile?: boolean;
  scoutedNumber?: number;
}) {
  const strengths = comp.strengths ?? [];
  const weaknesses = comp.weaknesses ?? [];
  const seasons = comp.season_stats ?? [];
  const secondary = comp.secondary_comp?.trim() ?? "";
  const fit = comp.front_office_fit?.trim() ?? "";
  const hasPC = strengths.length > 0 || weaknesses.length > 0;
  if (!hasPC && seasons.length === 0 && !secondary && !fit && scoutedNumber == null)
    return null;

  const sectionLabel = (text: string) => (
    <>
      <div
        style={{
          font: "500 10px 'JetBrains Mono', monospace",
          color: "#2f6043",
          letterSpacing: "0.24em",
          marginBottom: 14,
        }}
      >
        [ {text} ]
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(47,96,67,0.32)",
          marginBottom: mobile ? 18 : 24,
        }}
      />
    </>
  );

  const list = (items: string[], sign: string, color: string, heading: string) => (
    <div style={{ marginBottom: mobile ? 18 : 0 }}>
      <div
        style={{
          font: "500 11px 'JetBrains Mono', monospace",
          color,
          letterSpacing: "0.18em",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {heading}
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span
            style={{
              font: "600 15px 'Barlow Condensed'",
              color,
              flexShrink: 0,
              width: 10,
            }}
          >
            {sign}
          </span>
          <span style={{ font: "400 14px/1.5 'Inter'", color: "#4a463d" }}>{it}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        maxWidth: mobile ? undefined : 780,
        margin: "0 auto",
        padding: mobile ? "24px 22px 0" : "8px 56px 0",
      }}
    >
      {fit && (
        <div style={{ marginBottom: mobile ? 28 : 40 }}>
          {sectionLabel("BEST TEAM FIT")}
          <div style={{ font: "400 14px/1.6 'Inter'", color: "#4a463d" }}>
            {fit}
          </div>
        </div>
      )}
      {secondary && (
        <div style={{ marginBottom: mobile ? 22 : 30 }}>
          <div
            style={{
              font: "500 10px 'JetBrains Mono', monospace",
              color: "#2f6043",
              letterSpacing: "0.24em",
              marginBottom: 8,
            }}
          >
            [ ALSO IN THE TAPE ]
          </div>
          <div style={{ font: "400 14px/1.6 'Inter'", color: "#4a463d" }}>
            {secondary}
          </div>
        </div>
      )}
      {scoutedNumber != null && (
        <div
          style={{
            font: "500 11px 'JetBrains Mono', monospace",
            color: "#a8a090",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: mobile ? 22 : 30,
          }}
        >
          You're the {ordinal(scoutedNumber)} career scouted.
        </div>
      )}
      {hasPC && (
        <div style={{ marginBottom: mobile ? 28 : 40 }}>
          {sectionLabel("STRENGTHS & WEAKNESSES")}
          <div
            style={{
              display: mobile ? "block" : "grid",
              gridTemplateColumns: mobile ? undefined : "1fr 1fr",
              gap: mobile ? 0 : 40,
            }}
          >
            {strengths.length > 0 && list(strengths, "+", "#2f6043", "Strengths")}
            {weaknesses.length > 0 && list(weaknesses, "−", "#bd5024", "Weaknesses")}
          </div>
        </div>
      )}
      {seasons.length > 0 && (
        <div style={{ marginBottom: mobile ? 28 : 40 }}>
          {sectionLabel("CAREER STATS BY SEASON")}
          <div>
            {seasons.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: mobile ? "1fr" : "92px 160px 1fr",
                  gap: mobile ? 2 : 16,
                  padding: mobile ? "10px 0" : "12px 0",
                  borderBottom: "1px solid rgba(33,30,23,0.08)",
                  alignItems: mobile ? "start" : "baseline",
                }}
              >
                <div
                  style={{
                    font: "500 11px 'JetBrains Mono', monospace",
                    color: "#2f6043",
                    letterSpacing: "0.1em",
                  }}
                >
                  {s.year}
                </div>
                <div
                  style={{
                    font: "600 13px 'Barlow Condensed'",
                    color: "#211e17",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.team}
                </div>
                <div
                  style={{
                    font: "400 13px/1.5 'Inter'",
                    color: "#4a463d",
                    marginTop: mobile ? 4 : 0,
                  }}
                >
                  {s.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Contract/draft cell: a label, a short text value, and an optional small note
// underneath (years+descriptor for contract; the read for draft). Wider/text
// values than StatCell's single numerics, so it runs a smaller value font.
function DealCell({
  label,
  value,
  note,
  mobile,
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  mobile: boolean;
  accent?: boolean;
}) {
  if (!value) return <div />;
  return (
    <div>
      <div
        style={{
          font: mobile
            ? "400 8px 'JetBrains Mono', monospace"
            : "400 10px 'JetBrains Mono', monospace",
          color: "#a8a090",
          letterSpacing: mobile ? "0.16em" : "0.18em",
          marginBottom: mobile ? 2 : 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mobile
            ? "500 12px 'JetBrains Mono', monospace"
            : "500 15px 'JetBrains Mono', monospace",
          color: accent ? "#2f6043" : "#211e17",
          textTransform: "uppercase",
        }}
      >
        {value}
      </div>
      {note ? (
        <div
          style={{
            font: mobile
              ? "400 8px 'JetBrains Mono', monospace"
              : "400 9px 'JetBrains Mono', monospace",
            color: "#6b655a",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

function StatCell({
  label,
  value,
  mobile,
  accent = false,
}: {
  label: string;
  value: string;
  mobile: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: mobile
            ? "400 8px 'JetBrains Mono', monospace"
            : "400 10px 'JetBrains Mono', monospace",
          color: "#a8a090",
          letterSpacing: mobile ? "0.16em" : "0.18em",
          marginBottom: mobile ? 0 : 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mobile
            ? "500 15px 'JetBrains Mono', monospace"
            : "500 22px 'JetBrains Mono', monospace",
          color: accent ? "#2f6043" : "#211e17",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TipLink({
  url,
  fontSize,
  letterSpacing,
}: {
  url: string;
  fontSize: number;
  letterSpacing: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        font: `500 ${fontSize}px 'JetBrains Mono', monospace`,
        color: "#2f6043",
        letterSpacing,
        textDecoration: "none",
        borderBottom: "1px solid rgba(47,96,67,0.5)",
        paddingBottom: 2,
      }}
    >
      TIP YOUR SCOUT &rarr;
    </a>
  );
}
