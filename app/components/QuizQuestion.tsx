"use client";

// =============================================================================
// Screen 02 — Quiz Question (intake form)
// Faithful conversion of the design export's Screen 02 (desktop 1280px artboard,
// lines ~274-335) + the 390px mobile artboard (lines ~577-612).
// Presentational only: renders the passed question/options, highlights the
// selected option, and calls onSelect. Auto-advance is handled by the parent.
// =============================================================================

import { useEffect, useState } from "react";
import type { QuizQuestionProps } from "@/lib/types";

// Roman numerals for the vertical "INTAKE FORM · SECTION <n>" rule. The export
// hardcodes "SECTION II"; here it tracks the live question index so the side
// label and progress stay in sync.
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

// Two-digit file number, e.g. 04. index is 0-based, so question 1 -> "01".
function fileNo(n: number): string {
  return String(n).padStart(2, "0");
}

// The scout-bg ink drift field — same glyphs/positions/timings as the export
// (lines ~278-293). Desktop only; hidden on mobile to match the 390 artboard.
const DRIFT: Array<{
  left: string;
  top: string;
  fontSize: number;
  durs: string;
  delays: string;
  text: string;
  mark?: "x-mark" | "o-mark";
}> = [
  { left: "3%", top: "24%", fontSize: 15, durs: "150s,18s", delays: "-40s,-5s", text: "+/-" },
  { left: "6%", top: "38%", fontSize: 13, durs: "130s,16s", delays: "-30s,-9s", text: "TS%" },
  { left: "2%", top: "52%", fontSize: 24, durs: "190s,24s", delays: "-95s,-3s", text: "X", mark: "x-mark" },
  { left: "7%", top: "64%", fontSize: 14, durs: "140s,20s", delays: "-60s,-7s", text: "AST" },
  { left: "3%", top: "78%", fontSize: 16, durs: "170s,22s", delays: "-85s,-4s", text: "MLE" },
  { left: "9%", top: "31%", fontSize: 12, durs: "110s,15s", delays: "-20s,-11s", text: "7.2" },
  { left: "5%", top: "87%", fontSize: 18, durs: "200s,26s", delays: "-100s,-6s", text: "B+" },
  { left: "90%", top: "22%", fontSize: 14, durs: "145s,19s", delays: "-35s,-6s", text: "PER" },
  { left: "94%", top: "36%", fontSize: 26, durs: "195s,25s", delays: "-110s,-2s", text: "O", mark: "o-mark" },
  { left: "88%", top: "50%", fontSize: 13, durs: "125s,17s", delays: "-28s,-10s", text: "BPM" },
  { left: "93%", top: "62%", fontSize: 16, durs: "165s,21s", delays: "-75s,-8s", text: "DRtg" },
  { left: "89%", top: "76%", fontSize: 12, durs: "115s,15s", delays: "-22s,-13s", text: "9.1" },
  { left: "95%", top: "30%", fontSize: 15, durs: "155s,20s", delays: "-90s,-5s", text: "VET" },
  { left: "91%", top: "88%", fontSize: 17, durs: "180s,23s", delays: "-70s,-4s", text: "A-" },
];

export default function QuizQuestion({
  index,
  total,
  question,
  selected,
  onSelect,
  onBack,
}: QuizQuestionProps) {
  // One responsive component: <=480px renders the 390 mobile artboard, wider
  // renders the desktop artboard. Tracked here (not via CSS) because the export
  // uses materially different markup/values per breakpoint.
  const isMobile = useIsMobile();

  const progress = Array.from({ length: total }, (_, i) => i);
  const roman = ROMAN[index] ?? String(index + 1);
  const sectionLabel = `SECTION ${roman} · ${question.section}`;

  // ---- Mobile (390 artboard) ----------------------------------------------
  if (isMobile) {
    return (
      <div className="paper-bg" style={mobileWrap}>
        <div style={mobileHeader}>
          <button
            type="button"
            className="ghost-ln"
            onClick={onBack}
            style={mobileBackBtn}
          >
            &larr; BACK
          </button>
          <div style={mobileFileNo}>
            [ FILE {fileNo(index + 1)} / {fileNo(total)} ]
          </div>
          <div style={{ width: 46 }} />
        </div>

        <div style={mobileDots}>
          {progress.map((i) => (
            <div key={i} style={dot(i, index, 7)} />
          ))}
        </div>

        <div style={{ padding: "56px 22px 0" }}>
          <div style={mobileOnFilm}>[ ON FILM ]</div>
          <h2 style={mobileQuestion}>{question.prompt}</h2>

          <div className="form-block">
            {question.options.map((option, i) => {
              const isSelected = option === selected;
              return (
                <div
                  key={i}
                  className={`form-row${isSelected ? " selected" : ""}`}
                  style={{ padding: 14 }}
                  onClick={() => onSelect(option)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(option);
                    }
                  }}
                >
                  <div className="form-marker">{fileNo(i + 1)}</div>
                  <div style={{ font: "400 14px/1.45 var(--font-body)", flex: 1 }}>
                    {option}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={mobileFooter}>
          <div style={mobileFooterTxt}>[ TAP TO SELECT · AUTO ADVANCE ]</div>
        </div>
      </div>
    );
  }

  // ---- Desktop (1280 artboard) --------------------------------------------
  return (
    <div className="paper-bg" style={desktopWrap}>
      <div className="scout-bg" aria-hidden="true">
        {DRIFT.map((d, i) => (
          <span
            key={i}
            className={d.mark}
            style={{
              left: d.left,
              top: d.top,
              fontSize: d.fontSize,
              animationDuration: d.durs,
              animationDelay: d.delays,
            }}
          >
            {d.text}
          </span>
        ))}
      </div>

      {/* side rules + vertical labels */}
      <div style={ruleLeft} />
      <div style={ruleRight} />
      <div style={vLabelLeft}>INTAKE FORM · {sectionLabel.split(" · ")[0]}</div>
      <div style={vLabelRight}>CONFIDENTIAL · NOT FOR FILE</div>

      <div style={desktopHeader}>
        <button
          type="button"
          className="ghost-ln"
          onClick={onBack}
          style={desktopBackBtn}
        >
          &larr; BACK
        </button>
        <div style={desktopFileNo}>
          [ FILE {fileNo(index + 1)} / {fileNo(total)} ]
        </div>
        <div style={desktopBrand}>[ CAREER PLAYER COMP ]</div>
      </div>

      <div style={desktopDots}>
        {progress.map((i) => (
          <div key={i} style={dot(i, index, 10)} />
        ))}
      </div>

      <div style={desktopCenter}>
        <div style={desktopOnFilm}>[ ON FILM ]</div>
        <h2 style={desktopQuestion}>{question.prompt}</h2>

        <div className="form-block">
          {question.options.map((option, i) => {
            const isSelected = option === selected;
            return (
              <div
                key={i}
                className={`form-row${isSelected ? " selected" : ""}`}
                onClick={() => onSelect(option)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(option);
                  }
                }}
              >
                <div className="form-marker">{fileNo(i + 1)}</div>
                <div
                  style={{
                    font: "400 17px/1.45 var(--font-body)",
                    color: "var(--ink)",
                    flex: 1,
                  }}
                >
                  {option}
                </div>
                {isSelected && <div style={selectedTag}>[ SELECTED ]</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={desktopFooter}>
        <div style={desktopFooterTxt}>[ TAP TO SELECT · AUTO ADVANCE ]</div>
        <div style={desktopFooterTxt}>[ {sectionLabel} ]</div>
      </div>
    </div>
  );
}

// One progress dot. Green for done/current; current also pulses. Faint after.
function dot(i: number, current: number, size: number): React.CSSProperties {
  const done = i <= current;
  return {
    width: size,
    height: size,
    background: done ? "var(--green)" : "rgba(33,30,23,0.14)",
    borderRadius: 1,
    ...(i === current
      ? { animation: "pulseDot 1.6s ease-in-out infinite" }
      : {}),
  };
}

// SSR-safe mobile detection at the 480px breakpoint (the cutover the prompt
// specifies). Defaults to desktop on the server, then corrects on mount.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// ---- style objects (values lifted verbatim from the export) ----------------

const MONO = "var(--font-mono)";
const DISPLAY = "var(--font-display)";

// ---- desktop ----
const desktopWrap: React.CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  fontFamily: "var(--font-body)",
};

const ruleLeft: React.CSSProperties = {
  position: "absolute",
  left: 40,
  top: 108,
  bottom: 88,
  width: 1,
  background: "rgba(47,96,67,0.16)",
  zIndex: 1,
};
const ruleRight: React.CSSProperties = { ...ruleLeft, left: undefined, right: 40 };

const vLabelLeft: React.CSSProperties = {
  position: "absolute",
  left: 16,
  top: "50%",
  transform: "translateY(-50%) rotate(180deg)",
  writingMode: "vertical-rl",
  font: `500 10px ${MONO}`,
  letterSpacing: "0.34em",
  color: "var(--faint)",
  zIndex: 1,
};
const vLabelRight: React.CSSProperties = {
  position: "absolute",
  right: 16,
  top: "50%",
  transform: "translateY(-50%)",
  writingMode: "vertical-rl",
  font: `500 10px ${MONO}`,
  letterSpacing: "0.34em",
  color: "var(--faint)",
  zIndex: 1,
};

const desktopHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "28px 56px",
  position: "relative",
  zIndex: 1,
};
const desktopBackBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(33,30,23,0.18)",
  color: "var(--muted)",
  padding: "8px 14px",
  font: `500 11px ${MONO}`,
  letterSpacing: "0.14em",
  borderRadius: 4,
};
const desktopFileNo: React.CSSProperties = {
  font: `500 11px ${MONO}`,
  color: "var(--muted)",
  letterSpacing: "0.22em",
};
const desktopBrand: React.CSSProperties = {
  font: `500 11px ${MONO}`,
  color: "var(--faint)",
  letterSpacing: "0.18em",
};

const desktopDots: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 14,
  marginTop: 18,
  position: "relative",
  zIndex: 1,
};

const desktopCenter: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  width: "100%",
  maxWidth: 780,
  margin: "0 auto",
  padding: "0 56px",
  boxSizing: "border-box",
  position: "relative",
  zIndex: 1,
};
const desktopOnFilm: React.CSSProperties = {
  font: `400 11px ${MONO}`,
  color: "var(--green)",
  letterSpacing: "0.28em",
  marginBottom: 24,
  textAlign: "center",
};
const desktopQuestion: React.CSSProperties = {
  font: `600 64px/1.05 ${DISPLAY}`,
  color: "var(--ink)",
  textAlign: "center",
  letterSpacing: "-0.005em",
  margin: "0 0 72px",
  textTransform: "uppercase",
  textWrap: "balance",
};
const selectedTag: React.CSSProperties = {
  font: `500 10px ${MONO}`,
  color: "var(--green)",
  letterSpacing: "0.2em",
};

const desktopFooter: React.CSSProperties = {
  margin: "0 56px 30px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: "1px solid rgba(33,30,23,0.12)",
  paddingTop: 20,
  position: "relative",
  zIndex: 1,
};
const desktopFooterTxt: React.CSSProperties = {
  font: `400 11px ${MONO}`,
  color: "var(--faint)",
  letterSpacing: "0.18em",
};

// ---- mobile (390 artboard) ----
const mobileWrap: React.CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  position: "relative",
  fontFamily: "var(--font-body)",
  overflow: "hidden",
};
const mobileHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 22px",
};
const mobileBackBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(33,30,23,0.18)",
  color: "var(--muted)",
  padding: "6px 10px",
  font: `500 10px ${MONO}`,
  letterSpacing: "0.14em",
  borderRadius: 4,
};
const mobileFileNo: React.CSSProperties = {
  font: `500 10px ${MONO}`,
  color: "var(--muted)",
  letterSpacing: "0.22em",
};
const mobileDots: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  marginTop: 14,
};
const mobileOnFilm: React.CSSProperties = {
  font: `400 10px ${MONO}`,
  color: "var(--green)",
  letterSpacing: "0.28em",
  marginBottom: 18,
  textAlign: "center",
};
const mobileQuestion: React.CSSProperties = {
  font: `600 34px/1.08 ${DISPLAY}`,
  color: "var(--ink)",
  textAlign: "center",
  letterSpacing: "-0.005em",
  margin: "0 0 40px",
  textTransform: "uppercase",
  textWrap: "balance",
};
const mobileFooter: React.CSSProperties = {
  position: "absolute",
  left: 22,
  right: 22,
  bottom: 22,
  textAlign: "center",
  borderTop: "1px solid rgba(33,30,23,0.12)",
  paddingTop: 16,
};
const mobileFooterTxt: React.CSSProperties = {
  font: `400 9.5px ${MONO}`,
  color: "var(--faint)",
  letterSpacing: "0.18em",
};
