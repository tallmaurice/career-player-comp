// =============================================================================
// Shared layout for the static legal pages (/privacy, /terms).
// Server component, no state. Matches the cream-paper / green design system:
// the home wordmark header, a readable content column (styled via the `.legal`
// block in globals.css), and the standard footer + disclaimer.
// =============================================================================

import type { ReactNode } from "react";

const MONO = "var(--font-mono)";
const DISPLAY = "var(--font-display)";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div
      className="paper-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "var(--ink)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* ---- header: home wordmark ---- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "clamp(18px, 3vw, 28px) clamp(22px, 5vw, 56px)",
        }}
      >
        <a
          href="/"
          aria-label="Career Player Comp — home"
          className="cpc-home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <div style={{ width: 8, height: 8, background: "var(--green)" }} />
          <span
            style={{
              font: `600 13px ${DISPLAY}`,
              letterSpacing: "0.22em",
              color: "var(--ink)",
            }}
          >
            CAREER PLAYER COMP
          </span>
        </a>
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: "var(--faint)",
            letterSpacing: "0.18em",
          }}
        >
          [ LEGAL ]
        </div>
      </header>

      {/* ---- content ---- */}
      <article
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
          padding: "clamp(12px, 3vw, 24px) clamp(22px, 5vw, 56px) 64px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            font: `700 clamp(34px, 6vw, 52px) ${DISPLAY}`,
            color: "var(--ink)",
            textTransform: "uppercase",
            letterSpacing: "-0.008em",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h1>
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: "var(--faint)",
            letterSpacing: "0.18em",
            marginBottom: 6,
          }}
        >
          Last updated {updated}
        </div>
        <div className="legal">{children}</div>
      </article>

      {/* ---- footer ---- */}
      <footer
        style={{
          marginTop: "auto",
          padding: "0 clamp(22px, 5vw, 56px) 30px",
          textAlign: "center",
          font: `400 11px ${MONO}`,
          color: "var(--faint)",
          letterSpacing: "0.14em",
          lineHeight: 1.7,
        }}
      >
        For entertainment. Not affiliated with the NBA, WNBA, or any player.
        <div style={{ marginTop: 8 }}>
          careerplayercomp.com · © 2026 Drapetomania LLC ·{" "}
          <a href="/privacy" style={{ color: "var(--faint)" }}>
            Privacy
          </a>{" "}
          ·{" "}
          <a href="/terms" style={{ color: "var(--faint)" }}>
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}
