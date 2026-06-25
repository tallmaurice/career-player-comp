"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoutingRoomProps } from "@/lib/types";

// Verbatim cycle from the design export (script block, screen 01c / 01cM).
const PHRASES = [
  "Pulling career film...",
  "Cross-referencing the tape...",
  "Consulting the front office...",
  "Finalizing your report...",
];

/**
 * Screen 01c — SCOUTING ROOM (loading).
 * Self-contained theater: a CSS/SVG VHS tape with two spinning reels and a
 * cycling monospace typewriter line. No props, no data fetching, no navigation
 * (the parent swaps screens when the engine call resolves).
 *
 * Faithful to the export: same layout, same inline style values, same shared
 * classes (.paper-bg, .vhs/.reel, .tw-caret). Desktop matches the 1280-wide
 * artboard; <=767px (the shared app breakpoint) matches the 390 mobile artboard.
 */
export default function ScoutingRoom(_props: ScoutingRoomProps) {
  const [text, setText] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion: show the first phrase statically; the reel spin + caret
    // blink are already disabled in globals.css, so don't run the JS loop.
    if (reduced) {
      setText(PHRASES[0]);
      return;
    }

    // Port of the export's typewriter loop (type 58ms, hold 1500ms, delete 30ms).
    let pi = 0;
    let ci = 0;
    let deleting = false;
    const tick = () => {
      const p = PHRASES[pi];
      if (!deleting) {
        ci++;
        setText(p.slice(0, ci));
        if (ci === p.length) {
          deleting = true;
          timers.current.push(setTimeout(tick, 1500));
          return;
        }
      } else {
        ci--;
        setText(p.slice(0, ci));
        if (ci === 0) {
          deleting = false;
          pi = (pi + 1) % PHRASES.length;
        }
      }
      timers.current.push(setTimeout(tick, deleting ? 30 : 58));
    };
    tick();

    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      t.length = 0;
    };
  }, []);

  return (
    <div
      className="paper-bg cpc-scout-room"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        overflow: "hidden",
      }}
    >
      <style>{`
        .cpc-scout-room .sr-label { font: 500 11px var(--font-mono); letter-spacing: 0.32em; margin-bottom: 52px; }
        .cpc-scout-room .vhs { width: 132px; margin: 0 auto 44px; }
        .cpc-scout-room .sr-line { font: 500 16px var(--font-mono); letter-spacing: 0.03em; min-height: 22px; }
        .cpc-scout-room .sr-foot { margin-top: 40px; font: 400 11px var(--font-mono); letter-spacing: 0.22em; }
        @media (max-width: 767px) {
          .cpc-scout-room .sr-label { font: 500 10px var(--font-mono); letter-spacing: 0.3em; margin-bottom: 40px; }
          .cpc-scout-room .vhs { width: 96px; margin: 0 auto 34px; }
          .cpc-scout-room .sr-line { font: 500 14px var(--font-mono); letter-spacing: 0.02em; min-height: 20px; padding: 0 24px; }
          .cpc-scout-room .sr-foot { margin-top: 32px; font: 400 10px var(--font-mono); letter-spacing: 0.2em; }
        }
      `}</style>

      <div style={{ textAlign: "center" }}>
        <div className="sr-label" style={{ color: "var(--green)" }}>
          [ SCOUTING ROOM ]
        </div>

        <svg
          className="vhs"
          viewBox="0 0 160 100"
          style={{ display: "block" }}
          aria-hidden="true"
        >
          <g
            fill="none"
            stroke="var(--green)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <rect x="6" y="8" width="148" height="84" rx="7" />
            <line x1="6" y1="26" x2="154" y2="26" strokeWidth="3.5" />
            <rect x="16" y="37" width="38" height="44" rx="4" />
            <rect x="61" y="37" width="38" height="44" rx="4" />
            <rect x="106" y="37" width="38" height="44" rx="4" />
            <path d="M34,46 Q22,59 34,72" strokeWidth="3" />
            <path d="M29,42 Q19,59 29,76" strokeWidth="3" />
            <path d="M126,46 Q138,59 126,72" strokeWidth="3" />
            <path d="M131,42 Q141,59 131,76" strokeWidth="3" />
          </g>
          <g
            className="reel"
            fill="none"
            stroke="var(--green)"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <circle cx="44" cy="59" r="6" />
            <line x1="44" y1="53.5" x2="44" y2="64.5" />
            <line x1="38.5" y1="59" x2="49.5" y2="59" />
          </g>
          <g
            className="reel"
            fill="none"
            stroke="var(--green)"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <circle cx="116" cy="59" r="6" />
            <line x1="116" y1="53.5" x2="116" y2="64.5" />
            <line x1="110.5" y1="59" x2="121.5" y2="59" />
          </g>
        </svg>

        <div className="sr-line" style={{ color: "var(--ink)" }} aria-live="polite">
          <span>{text}</span>
          <span className="tw-caret" />
        </div>

        <div className="sr-foot" style={{ color: "var(--faint)" }}>
          [ DO NOT CLOSE THIS TAB ]
        </div>
      </div>
    </div>
  );
}
