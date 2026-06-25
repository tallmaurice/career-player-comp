"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ChangeEvent, MouseEvent } from "react";
import type { OptionalTextProps } from "@/lib/types";
import { useIsMobile } from "@/lib/useIsMobile";

// =============================================================================
// OptionalText — Screens 09 & 10 ("on the record" / "final entry")
// One reusable component switched by `which` (9 | 10). Converted faithfully from
// the design export (09/10 desktop artboards + 09M/10M mobile 390 artboards).
// Presentational only: renders, calls onContinue / onSkip / onBack.
// Desktop <-> mobile is decided by the shared useIsMobile hook (live at 768px).
// =============================================================================

// One drifting scout mark in the background field.
interface DriftMark {
  left: string;
  top: string;
  fontSize: number;
  /** "duration,duration" — drift + breathe, comma-joined for animation-duration. */
  dur: string;
  /** "delay,delay" — drift + breathe, comma-joined for animation-delay. */
  delay: string;
  text: string;
  /** Barlow-rendered X/O marks use a class; stat abbreviations omit it. */
  mark?: "x-mark" | "o-mark";
}

interface ScreenConfig {
  eyebrow: string;
  leftRail: string;
  counter: string;
  cta: string;
  filledDots: number;
  totalDots: number;
  headingFont: string;
  headingFontMobile: string;
  ctaPadding: string;
  drift: DriftMark[];
}

// Per-screen copy/markers that differ between 09 and 10 in the export.
const CONFIG: Record<9 | 10, ScreenConfig> = {
  9: {
    eyebrow: "[ ON THE RECORD ]",
    leftRail: "BONUS FILE · ON THE RECORD",
    counter: "[ OPTIONAL · 09 / 10 ]",
    cta: "Continue",
    filledDots: 9,
    totalDots: 10,
    headingFont: "600 52px/1.08 'Barlow Condensed'",
    headingFontMobile: "600 28px/1.12 'Barlow Condensed'",
    ctaPadding: "16px 28px",
    // drift-field marks (left col then right col), verbatim from the export
    drift: [
      { left: "3%", top: "28%", fontSize: 15, dur: "150s,18s", delay: "-40s,-5s", text: "+/-" },
      { left: "6%", top: "46%", fontSize: 13, dur: "130s,16s", delay: "-30s,-9s", text: "TS%" },
      { left: "2%", top: "64%", fontSize: 24, dur: "190s,24s", delay: "-95s,-3s", text: "X", mark: "x-mark" },
      { left: "7%", top: "80%", fontSize: 14, dur: "140s,20s", delay: "-60s,-7s", text: "AST" },
      { left: "92%", top: "26%", fontSize: 14, dur: "145s,19s", delay: "-35s,-6s", text: "PER" },
      { left: "94%", top: "44%", fontSize: 26, dur: "195s,25s", delay: "-110s,-2s", text: "O", mark: "o-mark" },
      { left: "89%", top: "62%", fontSize: 13, dur: "125s,17s", delay: "-28s,-10s", text: "BPM" },
      { left: "93%", top: "80%", fontSize: 16, dur: "165s,21s", delay: "-75s,-8s", text: "A-" },
    ],
  },
  10: {
    eyebrow: "[ FINAL ENTRY · OFF THE STAT SHEET ]",
    leftRail: "BONUS FILE · FINAL ENTRY",
    counter: "[ OPTIONAL · 10 / 10 ]",
    cta: "Submit to the Front Office",
    filledDots: 10,
    totalDots: 10,
    headingFont: "600 46px/1.1 'Barlow Condensed'",
    headingFontMobile: "600 25px/1.16 'Barlow Condensed'",
    ctaPadding: "16px 30px",
    drift: [
      { left: "3%", top: "30%", fontSize: 15, dur: "152s,18s", delay: "-44s,-5s", text: "WS" },
      { left: "6%", top: "48%", fontSize: 13, dur: "132s,16s", delay: "-32s,-9s", text: "USG%" },
      { left: "2%", top: "66%", fontSize: 24, dur: "192s,24s", delay: "-97s,-3s", text: "O", mark: "o-mark" },
      { left: "7%", top: "82%", fontSize: 14, dur: "142s,20s", delay: "-62s,-7s", text: "REB" },
      { left: "92%", top: "24%", fontSize: 14, dur: "147s,19s", delay: "-37s,-6s", text: "eFG%" },
      { left: "94%", top: "42%", fontSize: 26, dur: "197s,25s", delay: "-112s,-2s", text: "X", mark: "x-mark" },
      { left: "89%", top: "60%", fontSize: 13, dur: "127s,17s", delay: "-30s,-10s", text: "DRtg" },
      { left: "93%", top: "80%", fontSize: 16, dur: "167s,21s", delay: "-77s,-8s", text: "A+" },
    ],
  },
};

const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

export default function OptionalText({
  which,
  prompt,
  placeholder,
  examples,
  value,
  onContinue,
  onSkip,
  onBack,
  onHome,
}: OptionalTextProps) {
  const isMobile = useIsMobile();
  const cfg = CONFIG[which];

  const [text, setText] = useState(value ?? "");

  // Persistent muted example beneath the textarea, cycling through the rotation
  // every 3.5s so users see the range, not just one frozen line.
  const [exIdx, setExIdx] = useState(0);
  useEffect(() => {
    if (!examples || examples.length <= 1) return;
    const id = setInterval(
      () => setExIdx((i) => (i + 1) % examples.length),
      3500,
    );
    return () => clearInterval(id);
  }, [examples]);
  const exampleLine =
    examples && examples.length > 0
      ? `e.g. ${examples[exIdx % examples.length]}`
      : "";

  // Step-progress dots (filled green, current pulses, trailing faint slot).
  const dots = [];
  for (let i = 0; i < cfg.totalDots; i++) {
    const isCurrent = i === cfg.filledDots - 1;
    const isFilled = i < cfg.filledDots;
    const size = isMobile ? 7 : 10;
    const base: CSSProperties = {
      width: size,
      height: size,
      borderRadius: 1,
      background: isFilled ? "#2f6043" : "rgba(33,30,23,0.14)",
    };
    if (isCurrent) base.animation = "pulseDot 1.6s ease-in-out infinite";
    dots.push(<div key={i} style={base} />);
  }

  if (isMobile) {
    return (
      <div
        className="paper-bg"
        style={{
          minHeight: "100vh",
          width: "100%",
          color: "var(--ink)",
          fontFamily: INTER,
          overflowX: "hidden",
        }}
      >
        {/* top bar: back / counter / spacer */}
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
            onClick={onBack}
            className="ghost-ln"
            style={{
              background: "transparent",
              border: "1px solid rgba(33,30,23,0.18)",
              color: "#6b655a",
              padding: "6px 10px",
              font: `500 10px ${MONO}`,
              letterSpacing: "0.14em",
              borderRadius: 4,
            }}
          >
            &larr; BACK
          </button>
          <div style={{ font: `500 10px ${MONO}`, color: "#6b655a", letterSpacing: "0.22em" }}>
            {cfg.counter}
          </div>
          <div style={{ width: 46 }} />
        </div>

        {/* progress dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 7,
            marginTop: 14,
            flexWrap: "wrap",
            padding: "0 22px",
          }}
        >
          {dots}
        </div>

        {/* body */}
        <div style={{ padding: which === 9 ? "48px 22px 0" : "40px 22px 0" }}>
          <div
            style={{
              font: `400 10px ${MONO}`,
              color: "#2f6043",
              letterSpacing: "0.28em",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {cfg.eyebrow}
          </div>
          <h2
            style={{
              font: cfg.headingFontMobile,
              color: "#211e17",
              textAlign: "center",
              letterSpacing: "-0.005em",
              margin: which === 9 ? "0 0 28px" : "0 0 26px",
              textTransform: "uppercase",
              textWrap: "balance",
            }}
          >
            {prompt}
          </h2>

          <div className="paste-area form-block" style={{ background: "#f4eede", marginBottom: 10 }}>
            <textarea
              data-rotate={`q${which}`}
              placeholder={placeholder}
              value={text}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "none",
                background: "transparent",
                resize: "none",
                padding: "18px 18px",
                font: `400 14px/1.6 ${INTER}`,
                color: "#211e17",
                outline: "none",
                minHeight: 130,
              }}
            />
          </div>

          <div style={{ font: `400 12px/1.45 ${INTER}`, color: "#a8a090", marginBottom: 16 }}>
            {exampleLine}
          </div>

          <button
            type="button"
            onClick={() => onContinue(text)}
            className="cta-green"
            style={{
              background: "#2f6043",
              color: "#f1ece0",
              border: "none",
              padding: "16px",
              font: `600 12px ${INTER}`,
              letterSpacing: which === 9 ? "0.14em" : "0.13em",
              textTransform: "uppercase",
              borderRadius: 4,
              width: "100%",
            }}
          >
            {cfg.cta} &nbsp;&rarr;
          </button>

          <div style={{ textAlign: "center", marginTop: 16, paddingBottom: 40 }}>
            <a
              href="#"
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                onSkip();
              }}
              style={{
                font: `500 10px ${MONO}`,
                color: "#6b655a",
                letterSpacing: "0.16em",
                textDecoration: "none",
                borderBottom: "1px solid rgba(33,30,23,0.25)",
                paddingBottom: 2,
              }}
            >
              SKIP THIS ONE &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- Desktop -------------------------------------------------------------
  return (
    <div
      className="paper-bg"
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        color: "var(--ink)",
        fontFamily: INTER,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* drifting scout marks */}
      <div className="scout-bg" aria-hidden="true">
        {cfg.drift.map((d, i) => (
          <span
            key={i}
            className={d.mark}
            style={{
              left: d.left,
              top: d.top,
              fontSize: d.fontSize,
              animationDuration: d.dur,
              animationDelay: d.delay,
            }}
          >
            {d.text}
          </span>
        ))}
      </div>

      {/* faint side rules */}
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 108,
          bottom: 88,
          width: 1,
          background: "rgba(47,96,67,0.16)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 108,
          bottom: 88,
          width: 1,
          background: "rgba(47,96,67,0.16)",
          zIndex: 1,
        }}
      />

      {/* vertical rail labels */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%) rotate(180deg)",
          writingMode: "vertical-rl",
          font: `500 10px ${MONO}`,
          letterSpacing: "0.34em",
          color: "#a8a090",
          zIndex: 1,
        }}
      >
        {cfg.leftRail}
      </div>
      <div
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          writingMode: "vertical-rl",
          font: `500 10px ${MONO}`,
          letterSpacing: "0.34em",
          color: "#a8a090",
          zIndex: 1,
        }}
      >
        OPTIONAL · SKIP ANYTIME
      </div>

      {/* top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 56px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="ghost-ln"
          style={{
            background: "transparent",
            border: "1px solid rgba(33,30,23,0.18)",
            color: "#6b655a",
            padding: "8px 14px",
            font: `500 11px ${MONO}`,
            letterSpacing: "0.14em",
            borderRadius: 4,
          }}
        >
          &larr; BACK
        </button>
        <div style={{ font: `500 11px ${MONO}`, color: "#6b655a", letterSpacing: "0.22em" }}>
          {cfg.counter}
        </div>
        <button
          type="button"
          onClick={onHome}
          aria-label="Career Player Comp — home"
          className="cpc-home"
          style={{
            font: `500 11px ${MONO}`,
            color: "#a8a090",
            letterSpacing: "0.18em",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
        >
          [ CAREER PLAYER COMP ]
        </button>
      </div>

      {/* progress dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          marginTop: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        {dots}
      </div>

      {/* body */}
      <div
        style={{
          maxWidth: 820,
          margin: "96px auto 0",
          padding: "0 56px 96px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: "#2f6043",
            letterSpacing: "0.28em",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {cfg.eyebrow}
        </div>
        <h2
          style={{
            font: cfg.headingFont,
            color: "#211e17",
            textAlign: "center",
            letterSpacing: "-0.005em",
            margin: "0 0 40px",
            textTransform: "uppercase",
            textWrap: "balance",
          }}
        >
          {prompt}
        </h2>

        <div className="paste-area form-block" style={{ background: "#f4eede", marginBottom: 10 }}>
          <textarea
            data-rotate={`q${which}`}
            placeholder={placeholder}
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              background: "transparent",
              resize: "none",
              padding: "22px 24px",
              font: `400 16px/1.6 ${INTER}`,
              color: "#211e17",
              outline: "none",
              minHeight: 150,
            }}
          />
        </div>

        <div style={{ font: `400 13px/1.5 ${INTER}`, color: "#a8a090", marginBottom: 20 }}>
          {exampleLine}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a
            href="#"
            onClick={(e: MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              onSkip();
            }}
            style={{
              font: `500 11px ${MONO}`,
              color: "#6b655a",
              letterSpacing: "0.16em",
              textDecoration: "none",
              borderBottom: "1px solid rgba(33,30,23,0.25)",
              paddingBottom: 2,
            }}
          >
            SKIP THIS ONE &rarr;
          </a>
          <button
            type="button"
            onClick={() => onContinue(text)}
            className="cta-green"
            style={{
              background: "#2f6043",
              color: "#f1ece0",
              border: "none",
              padding: cfg.ctaPadding,
              font: `600 13px ${INTER}`,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderRadius: 4,
            }}
          >
            {cfg.cta} &nbsp;&rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
