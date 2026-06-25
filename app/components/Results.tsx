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

import type { ResultsProps, Badge, BadgeCategory, Comp } from "@/lib/types";
import { useState } from "react";
import { useTilt } from "@/lib/useTilt";
import { useIsMobile } from "@/lib/useIsMobile";

// ---- creator / B2B links (muted, scouting-doc style) ------------------------
// TODO(maurice): confirm the real creator URL before launch. Defaults to the
// LinkedIn profile; override per-deploy with NEXT_PUBLIC_CREATOR_URL.
const CREATOR_URL =
  process.env.NEXT_PUBLIC_CREATOR_URL ??
  "https://www.linkedin.com/in/maurice-peebles";
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
// (base64url encoder mirrors encodeComp() in app/page.tsx.)
function encodeCardComp(comp: Comp): string {
  const slim = {
    player_name: comp.player_name,
    position_era: comp.position_era,
    archetype_title: comp.archetype_title,
    badges: comp.badges,
    card_summary: comp.card_summary,
    stat_line: comp.stat_line,
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

// ---- Grade bars are DISPLAY-DERIVED -----------------------------------------
// The Comp contract has no scoring/defense/playmaking/culture grades. The
// export shows four graded bars purely as scouting-report set dressing. Rather
// than fabricate per-user numbers we don't have, we render the export's exact
// tasteful default set (C / A- / B / A+). If a future engine version emits real
// grades, swap GRADE_BARS for a mapping off `comp`. The label/letter/suffix and
// bar width are all visual constants here, intentionally not tied to the user.
const GRADE_BARS: Array<{
  label: string;
  color: string;
  width: string; // bar fill width
  letter: string; // grade letter
  suffix: string; // + / - / "" — sits in the fixed-width .suf slot so letters align
}> = [
  { label: "SCORING", color: "#bd5024", width: "42%", letter: "C", suffix: "" },
  { label: "DEFENSE", color: "#356287", width: "88%", letter: "A", suffix: "−" },
  { label: "PLAYMAKING", color: "#3a8054", width: "71%", letter: "B", suffix: "" },
  { label: "CULTURE", color: "#8f7220", width: "94%", letter: "A", suffix: "+" },
];

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
// "2-4 short paragraphs" as a single string; the export's named subsections
// (Floor Game / Intangibles / ...) are NOT in the data, so we render plain
// paragraphs split on blank lines (falling back to the whole string).
function toParagraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

export default function Results({
  comp,
  onAppeal,
  onHome,
  tipUrl,
}: // cardImageUrl is still part of ResultsProps (and passed by page.tsx), but we
// no longer read it here: the card URL is now derived from a slim, 414-safe
// payload below (see cardUrl / encodeCardComp).
ResultsProps) {
  // Match the desktop vs 390px mobile artboard with one component, flipping live
  // across the shared 768px breakpoint (see @/lib/useIsMobile).
  const isMobile = useIsMobile();
  // After Share fires, the tip copy softens from the long pitch to the short
  // post-share line (mirrors the export's data-tip-target / .tip-soft swap).
  const [shared, setShared] = useState(false);

  const badges = comp.badges.slice(0, 3);
  const reportParagraphs = toParagraphs(comp.full_report);
  const stat = {
    seasons: tightenNumber(comp.stat_line.seasons),
    teams: tightenNumber(comp.stat_line.teams),
    pivots: tightenNumber(comp.stat_line.pivots),
    status: tightenStatus(comp.stat_line.contract_status),
  };

  // Build the card-image URL from the SLIM payload (see encodeCardComp), not the
  // full-comp `cardImageUrl` prop, so a long full_report can't 414 the GET.
  const cardUrl = `/api/card?format=feed&data=${encodeCardComp(comp)}`;
  const fileName = `scouting-report-${comp.player_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.png`;

  // Fetch the rendered PNG as a blob and trigger a real browser download.
  const downloadCardPng = async () => {
    const res = await fetch(cardUrl);
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

    // 1) Try sharing the actual PNG file (best result on mobile).
    if (navAny.share) {
      try {
        const res = await fetch(cardUrl);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: "image/png" });
          if (!navAny.canShare || navAny.canShare({ files: [file] })) {
            await navAny.share({ title: shareTitle, text: shareText, files: [file] });
            return;
          }
        }
      } catch {
        // file share unsupported or cancelled — try URL share next
      }
      // 2) Share the absolute card URL as a link.
      try {
        await navAny.share({
          title: shareTitle,
          text: shareText,
          url: new URL(cardUrl, window.location.origin).toString(),
        });
        return;
      } catch {
        // cancelled or failed — fall through to copy/download
      }
    }

    // 3) No Web Share API: copy the link, else download the PNG.
    const absolute = new URL(cardUrl, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolute);
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
        new URL(cardUrl, window.location.origin).toString(),
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
            <CardTilt />
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
                Dialed down ~16% (38 -> 32px) so the right column reads as
                supporting detail under the hero card, not a second headline. */}
            <h2
              style={{
                font: "700 32px/1.05 'Barlow Condensed'",
                color: "#211e17",
                textTransform: "uppercase",
                letterSpacing: "-0.005em",
                margin: "0 0 20px",
              }}
            >
              {comp.why_this_player}
            </h2>
            {/* prose para 1 = card_summary (the on-card summary, echoed here).
                Annotation prose dropped a step (14.5 -> 13px). */}
            <p
              style={{
                font: "400 13px/1.65 'Inter'",
                color: "#4a463d",
                margin: "0 0 16px",
              }}
            >
              <span style={{ fontStyle: "italic", color: "#6b655a" }}>
                In summary,{" "}
              </span>
              {comp.card_summary}
            </p>
            {/* prose para 2 = front_office_fit (12.5px, a notch under para 1) */}
            <p
              style={{
                font: "400 12.5px/1.6 'Inter'",
                color: "#6b655a",
                margin: "0 0 34px",
              }}
            >
              {comp.front_office_fit}
            </p>

            {/* grade bars (display-derived; see GRADE_BARS comment) */}
            <div style={{ borderTop: "1px solid rgba(33,30,23,0.14)" }}>
              {GRADE_BARS.map((g, i) => (
                <div
                  key={g.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 44px",
                    gap: 18,
                    padding: "16px 0",
                    borderBottom:
                      i < GRADE_BARS.length - 1
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
                  J. Rivera
                </div>
                <div
                  style={{
                    font: "400 9.5px 'JetBrains Mono', monospace",
                    color: "#a8a090",
                    letterSpacing: "0.2em",
                    marginTop: 3,
                  }}
                >
                  [ SCOUTING DEPT. · 17 YRS ]
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
                JR
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
                Share Report &nbsp;&rarr;
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
                font: "400 12.5px/1.5 'Inter'",
                color: "#6b655a",
                marginTop: 16,
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
                // Full-report body dropped a step (15 -> 13px) so it reads as
                // supporting detail beside the hero card.
                font: "400 13px/1.72 'Inter'",
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
            [ END OF REPORT · FILE No. 2026-4471 · J. RIVERA ]
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

        {/* scout's note header (above card on mobile) */}
        <div style={{ padding: "26px 22px 10px" }}>
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
              font: "700 30px/1.0 'Barlow Condensed'",
              textTransform: "uppercase",
              letterSpacing: "-0.005em",
              margin: "0 0 8px",
            }}
          >
            {comp.why_this_player}
          </h2>
          <div
            style={{
              font: "400 11px 'Inter'",
              color: "#6b655a",
              fontStyle: "italic",
            }}
          >
            Drag the card. Tilt your phone. It responds.
          </div>
        </div>

        {/* hero tilt card */}
        <CardTilt mobile />

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

        {/* grade bars (display-derived) */}
        <div style={{ padding: "14px 22px 0" }}>
          <div style={{ borderTop: "1px solid rgba(33,30,23,0.14)" }}>
            {GRADE_BARS.map((g, i) => (
              <div
                key={g.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 34px",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom:
                    i < GRADE_BARS.length - 1
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
            Share Report &nbsp;&rarr;
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
                font: "400 13.5px/1.7 'Inter'",
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

  // ---------------------------------------------------------------------------
  // The hero tilt paper-card. Pointer- and touch-driven 3D tilt via useTilt;
  // the on-screen card keeps the grain/tilt/noise the satori card route can't
  // render. `mobile` toggles the smaller artboard's font sizes/padding.
  // ---------------------------------------------------------------------------
  function CardTilt({ mobile = false }: { mobile?: boolean }) {
    // Pointer + touch tilt, reduced-motion-aware. The resting lean
    // (rotateX(-5deg) rotateY(8deg)) and the eased snap-back live in .tilt-card.
    const { wrapRef, cardRef } = useTilt();

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

          {/* player_name */}
          <div
            className="layer-z3"
            style={{
              font: mobile
                ? "700 44px/0.92 'Barlow Condensed'"
                : "700 76px/0.92 'Barlow Condensed'",
              color: "#211e17",
              textTransform: "uppercase",
              letterSpacing: "-0.008em",
              marginBottom: mobile ? 8 : 10,
            }}
          >
            {comp.player_name}
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
              return (
                <span
                  key={i}
                  title={b.earned_by}
                  style={{
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
        </div>
      </div>
    );
  }
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
