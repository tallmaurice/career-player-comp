"use client";

// =============================================================================
// Screen 01 — LANDING
// Faithful conversion of the design export's Screen 01 (desktop, export lines
// ~117-272) and Screen 01M (mobile 390, export lines ~470-573).
// One responsive component: desktop artboard at wide widths, the 390 mobile
// artboard at <= 767px (the shared app-wide breakpoint, toggled here in CSS to
// match the JS useIsMobile screens). Inline style values are preserved verbatim from the
// export; shared classes (.scout-bg, .paper-card, .tilt-card, .stamp, .file-no,
// .grade, .cta-green) come from app/globals.css. Presentational only — the CTA
// calls LandingProps.onStart.
// =============================================================================

import { useEffect, useState, type CSSProperties } from "react";
import type { LandingProps } from "@/lib/types";
import { useTilt } from "@/lib/useTilt";

// Shared "clickable home wordmark" affordance: strips button chrome, adds a
// pointer cursor + a subtle hover so the top-left wordmark reads as a link back
// to the landing screen. Used by every screen's header (see globals usage).
const homeBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

// The grade rows in the sample card (Manu Ginóbili). Drives both artboards so
// the four scouting categories stay in sync.
const GRADES: {
  label: string;
  color: string;
  width: string;
  letter: string;
  suffix: string;
}[] = [
  { label: "SCORING", color: "#bd5024", width: "70%", letter: "B", suffix: "" },
  { label: "DEFENSE", color: "#356287", width: "62%", letter: "B", suffix: "−" },
  { label: "PLAYMAKING", color: "#3a8054", width: "84%", letter: "A", suffix: "−" },
  { label: "CULTURE", color: "#8f7220", width: "95%", letter: "A", suffix: "+" },
];

const SAMPLE_SUMMARY_DESKTOP =
  "Comes off the bench because that is where the team needs him, not because he isn't a starter. Builds compounding value through repeat motions inside a system he didn't design.";
const SAMPLE_SUMMARY_MOBILE =
  "Comes off the bench because that is where the team needs him. Builds compounding value through repeat motions inside a system he didn't design.";

export default function Landing({ onStart, onHome }: LandingProps) {
  // Live "N careers scouted" social proof. Fetched client-side from /api/scouted
  // (the global Redis counter /api/generate-comp increments). Stays null until a
  // positive total comes back, so the line is hidden at 0 or on any fetch failure
  // — the hero never shows a placeholder or a zero.
  const [scouted, setScouted] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/scouted")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const total = Number(d?.total);
        if (live && Number.isFinite(total) && total > 0) setScouted(total);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      {/* Responsive switch + drift-field animation tokens. The export ships two
          fixed-width artboards; here each is a fluid full-viewport layout and we
          show one at a time. Drift spans set their own duration/delay inline. */}
      <style>{`
        .cpc-landing-desktop { display: flex; }
        .cpc-landing-mobile { display: none; }
        @media (max-width: 767px) {
          .cpc-landing-desktop { display: none; }
          .cpc-landing-mobile { display: block; }
        }
      `}</style>

      <LandingDesktop onStart={onStart} onHome={onHome} scouted={scouted} />
      <LandingMobile onStart={onStart} onHome={onHome} scouted={scouted} />
    </>
  );
}

// ---- DESKTOP (export Screen 01) --------------------------------------------

function LandingDesktop({
  onStart,
  onHome,
  scouted,
}: LandingProps & { scouted: number | null }) {
  return (
    <div
      className="cpc-landing-desktop paper-bg"
      style={{
        minHeight: "100vh",
        width: "100%",
        flexDirection: "column",
        color: "#211e17",
        fontFamily: "var(--font-body)",
        overflow: "hidden",
        isolation: "isolate",
        position: "relative",
      }}
    >
      <ScoutBgDesktop />

      {/* header */}
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
          onClick={onHome}
          aria-label="Career Player Comp — home"
          className="cpc-home"
          style={homeBtnStyle}
        >
          <div style={{ width: "8px", height: "8px", background: "#2f6043" }} />
          <div
            style={{
              font: "600 13px var(--font-display)",
              letterSpacing: "0.22em",
              color: "#211e17",
            }}
          >
            CAREER PLAYER COMP
          </div>
        </button>
        <div
          style={{
            font: "400 11px var(--font-mono)",
            color: "#a8a090",
            letterSpacing: "0.18em",
          }}
        >
          [ EST. 2026 · NO ACCOUNT ]
        </div>
      </div>

      {/* hero grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: "64px",
          padding: "0 56px",
          alignItems: "center",
          flex: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* left column — copy + CTA + honest stats */}
        <div>
          <div
            style={{
              font: "400 11px var(--font-mono)",
              letterSpacing: "0.28em",
              color: "#2f6043",
              marginBottom: "28px",
            }}
          >
            [ VOL. 01 · SCOUTING DEPT. ]
          </div>
          <h1
            style={{
              font: "700 92px/0.92 var(--font-display)",
              letterSpacing: "-0.01em",
              color: "#211e17",
              margin: "0 0 28px",
              textTransform: "uppercase",
              textWrap: "balance",
            }}
          >
            Which <span style={{ color: "#2f6043" }}>NBA player</span> had your
            career?
          </h1>
          <p
            style={{
              font: "400 17px/1.55 var(--font-body)",
              color: "#6b655a",
              maxWidth: "520px",
              margin: "0 0 28px",
            }}
          >
            Upload your LinkedIn. Answer 8 questions. Get a scouting report that
            reads your work history the way a front office reads a prospect.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "11px",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                background: "#2f6043",
                borderRadius: "50%",
                boxShadow: "0 0 0 3px rgba(47,96,67,0.15)",
                flexShrink: 0,
              }}
            />
            <div style={{ font: "400 14px var(--font-body)", color: "#6b655a" }}>
              <span style={{ color: "#211e17", fontWeight: 500 }}>
                Private by default.
              </span>{" "}
              Your PDF is read in your browser. We store none of it.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: scouted ? "26px" : "60px",
            }}
          >
            <button
              type="button"
              onClick={onStart}
              className="cta-green"
              style={{
                background: "#2f6043",
                color: "#f1ece0",
                border: "none",
                padding: "18px 32px",
                font: "600 14px var(--font-body)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                borderRadius: "4px",
              }}
            >
              Start My Scouting Report &nbsp;&rarr;
            </button>
            <div
              style={{
                font: "400 11px var(--font-mono)",
                color: "#a8a090",
                letterSpacing: "0.16em",
              }}
            >
              ~ 90 SECONDS
            </div>
          </div>
          {scouted ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                marginBottom: "34px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  background: "#2f6043",
                  borderRadius: "50%",
                  boxShadow: "0 0 0 3px rgba(47,96,67,0.15)",
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  font: "400 11px var(--font-mono)",
                  color: "#2f6043",
                  letterSpacing: "0.18em",
                }}
              >
                {scouted.toLocaleString()} CAREERS SCOUTED
              </div>
            </div>
          ) : null}
          <div
            style={{
              borderTop: "1px solid rgba(33,30,23,0.14)",
              paddingTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "24px",
              maxWidth: "560px",
            }}
          >
            {/* keep in sync with the player pool count (lib/engine/player-pool.json) */}
            <HonestStat label="ARCHETYPES" value="204" />
            <HonestStat label="ACCOUNT" value="NONE NEEDED" />
            <HonestStat label="DATA STORED" value="NONE" />
          </div>
        </div>

        {/* right column — tilted sample card (the card owns its own
            .tilt-wrap / .tilt-card so the pointer tilt stays self-contained) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <SampleCardDesktop />
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          margin: "0 56px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "20px",
          zIndex: 1,
          position: "relative",
        }}
      >
        <div
          style={{
            font: "400 11px var(--font-mono)",
            color: "#a8a090",
            letterSpacing: "0.18em",
          }}
        >
          [ RUNS ON AI · NO ACCOUNT NEEDED · NO DATA STORED ]
        </div>
        <div
          style={{
            font: "400 11px var(--font-mono)",
            color: "#a8a090",
            letterSpacing: "0.18em",
          }}
        >
          careerplayercomp.com
        </div>
      </div>
    </div>
  );
}

function HonestStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          font: "500 11px var(--font-mono)",
          color: "#a8a090",
          letterSpacing: "0.16em",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "600 22px var(--font-display)",
          color: "#211e17",
          letterSpacing: "0.04em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SampleCardDesktop() {
  const { wrapRef, cardRef } = useTilt();
  return (
    <div className="tilt-wrap" ref={wrapRef}>
      <div
        ref={cardRef}
        className="paper-card tilt-card"
        style={{ width: "430px", padding: "30px 28px" }}
      >
      <div className="stamp">
        <span className="dept">SCOUTING DEPT.</span>
        <span className="cls">CLASS B · SAMPLE</span>
      </div>
      <div
        style={{
          font: "500 10px var(--font-mono)",
          letterSpacing: "0.22em",
          color: "#6b655a",
          marginBottom: "16px",
        }}
      >
        [ SCOUTING REPORT ]
      </div>
      <div className="file-no" style={{ marginBottom: "18px" }}>
        FILE No. 2026-4471
      </div>
      <div
        style={{
          font: "700 46px/0.95 var(--font-display)",
          color: "#211e17",
          textTransform: "uppercase",
          letterSpacing: "-0.005em",
          marginBottom: "8px",
        }}
      >
        Manu Gin&oacute;bili
      </div>
      <div
        style={{
          font: "500 11px var(--font-mono)",
          color: "#6b655a",
          letterSpacing: "0.14em",
          marginBottom: "18px",
        }}
      >
        SHOOTING GUARD &middot; 2000s&ndash;2010s
      </div>
      <div
        style={{
          font: "600 18px var(--font-display)",
          color: "#2f6043",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: "14px",
        }}
      >
        The Sixth-Man Operator
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(47,96,67,0.3)",
          marginBottom: "16px",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <CardBadge label="CLUTCH MERCHANT" color="#bd5024" borderColor="rgba(189,80,36,0.45)" />
        <CardBadge label="QUIET LEADER" color="#356287" borderColor="rgba(54,98,135,0.5)" />
        <CardBadge label="ROLE CLARITY" color="#3a8054" borderColor="rgba(58,128,84,0.5)" />
      </div>
      <div
        style={{
          font: "400 13px/1.55 var(--font-body)",
          color: "#4a463d",
          marginBottom: "16px",
        }}
      >
        {SAMPLE_SUMMARY_DESKTOP}
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(33,30,23,0.12)",
          marginBottom: "12px",
        }}
      />
      <div style={{ marginBottom: "14px" }}>
        {GRADES.map((g, i) => (
          <div
            key={g.label}
            style={{
              display: "grid",
              gridTemplateColumns: "84px 1fr 34px",
              gap: "12px",
              alignItems: "center",
              padding: "7px 0",
              borderBottom:
                i < GRADES.length - 1
                  ? "1px solid rgba(33,30,23,0.08)"
                  : undefined,
            }}
          >
            <div
              style={{
                font: "500 9px var(--font-mono)",
                color: g.color,
                letterSpacing: "0.14em",
              }}
            >
              {g.label}
            </div>
            <div
              style={{
                height: "5px",
                background: "rgba(33,30,23,0.08)",
                borderRadius: "1px",
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", width: g.width, background: g.color }} />
            </div>
            <div className="grade">
              <span className="ltr" style={{ fontSize: "18px", color: g.color }}>
                {g.letter}
              </span>
              <span
                className="suf"
                style={{ fontSize: "11px", width: "8px", color: g.color }}
              >
                {g.suffix}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(33,30,23,0.12)",
          marginBottom: "14px",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "10px",
        }}
      >
        <CardStat label="SEASONS" value="12" />
        <CardStat label="TEAMS" value="02" />
        <CardStat label="PIVOTS" value="01" />
        <CardStat label="STATUS" value="RFA" valueColor="#2f6043" />
      </div>
      </div>
    </div>
  );
}

function CardBadge({
  label,
  color,
  borderColor,
}: {
  label: string;
  color: string;
  borderColor: string;
}) {
  return (
    <span
      style={{
        font: "500 10px var(--font-mono)",
        letterSpacing: "0.14em",
        padding: "5px 9px",
        border: `1px solid ${borderColor}`,
        color,
        borderRadius: "3px",
      }}
    >
      {label}
    </span>
  );
}

function CardStat({
  label,
  value,
  valueColor = "#211e17",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          font: "400 9px var(--font-mono)",
          color: "#a8a090",
          letterSpacing: "0.16em",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div style={{ font: "500 16px var(--font-mono)", color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

// ---- MOBILE (export Screen 01M, 390) ---------------------------------------

function LandingMobile({
  onStart,
  onHome,
  scouted,
}: LandingProps & { scouted: number | null }) {
  return (
    <div
      className="cpc-landing-mobile paper-bg"
      style={{
        minHeight: "100vh",
        width: "100%",
        color: "#211e17",
        fontFamily: "var(--font-body)",
        overflow: "hidden",
        isolation: "isolate",
        position: "relative",
      }}
    >
      <ScoutBgMobile />

      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onHome}
          aria-label="Career Player Comp — home"
          className="cpc-home"
          style={{ ...homeBtnStyle, gap: "8px", color: "#211e17" }}
        >
          <div style={{ width: "6px", height: "6px", background: "#2f6043" }} />
          <div
            style={{
              font: "600 11px var(--font-display)",
              letterSpacing: "0.22em",
            }}
          >
            CAREER PLAYER COMP
          </div>
        </button>
        <div
          style={{
            font: "400 9px var(--font-mono)",
            color: "#a8a090",
            letterSpacing: "0.16em",
          }}
        >
          [ VOL. 01 ]
        </div>
      </div>

      {/* hero copy */}
      <div style={{ padding: "36px 22px 20px", position: "relative", zIndex: 1 }}>
        <div
          style={{
            font: "400 10px var(--font-mono)",
            letterSpacing: "0.24em",
            color: "#2f6043",
            marginBottom: "16px",
          }}
        >
          [ SCOUTING DEPT. ]
        </div>
        <h1
          style={{
            font: "700 50px/0.94 var(--font-display)",
            color: "#211e17",
            margin: "0 0 16px",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            textWrap: "balance",
          }}
        >
          Which <span style={{ color: "#2f6043" }}>NBA player</span> had your
          career?
        </h1>
        <p
          style={{
            font: "400 15px/1.55 var(--font-body)",
            color: "#6b655a",
            margin: "0 0 18px",
          }}
        >
          Upload your LinkedIn. Answer 8 questions. Get a scouting report that
          reads your work history the way a front office reads a prospect.
        </p>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
          <div
            style={{
              width: "7px",
              height: "7px",
              marginTop: "5px",
              background: "#2f6043",
              borderRadius: "50%",
              boxShadow: "0 0 0 3px rgba(47,96,67,0.15)",
              flexShrink: 0,
            }}
          />
          <div style={{ font: "400 13px/1.45 var(--font-body)", color: "#6b655a" }}>
            <span style={{ color: "#211e17", fontWeight: 500 }}>
              Private by default.
            </span>{" "}
            Your PDF is read in your browser. We store none of it.
          </div>
        </div>
      </div>

      {/* sample card (owns its own .tilt-wrap / .tilt-card for the tilt) */}
      <div
        style={{ padding: "0 22px 22px", position: "relative", zIndex: 1 }}
      >
        <SampleCardMobile />
      </div>

      {/* CTA */}
      <div style={{ padding: "0 22px 22px", position: "relative", zIndex: 1 }}>
        <button
          type="button"
          onClick={onStart}
          className="cta-green"
          style={{
            background: "#2f6043",
            color: "#f1ece0",
            border: "none",
            padding: "18px",
            font: "600 13px var(--font-body)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderRadius: "4px",
            width: "100%",
          }}
        >
          Start My Scouting Report &nbsp;&rarr;
        </button>
        <div
          style={{
            font: "400 10px var(--font-mono)",
            color: "#a8a090",
            letterSpacing: "0.18em",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          [ ~ 90 SECONDS · NO DATA STORED ]
        </div>
        {scouted ? (
          <div
            style={{
              font: "400 10px var(--font-mono)",
              color: "#2f6043",
              letterSpacing: "0.18em",
              textAlign: "center",
              marginTop: "10px",
            }}
          >
            [ {scouted.toLocaleString()} CAREERS SCOUTED ]
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SampleCardMobile() {
  const { wrapRef, cardRef } = useTilt();
  return (
    <div className="tilt-wrap" ref={wrapRef}>
      <div
        ref={cardRef}
        className="paper-card tilt-card"
        style={{ padding: "22px 20px" }}
      >
      <div className="stamp" style={{ top: "12px", right: "12px" }}>
        <span className="dept">SCOUTING DEPT.</span>
        <span className="cls">SAMPLE</span>
      </div>
      <div
        style={{
          font: "500 9px var(--font-mono)",
          letterSpacing: "0.2em",
          color: "#6b655a",
          marginBottom: "12px",
        }}
      >
        [ SCOUTING REPORT ]
      </div>
      <div
        className="file-no"
        style={{ marginBottom: "14px", fontSize: "9px" }}
      >
        FILE No. 2026-4471
      </div>
      <div
        style={{
          font: "700 36px/0.95 var(--font-display)",
          textTransform: "uppercase",
          letterSpacing: "-0.005em",
          marginBottom: "6px",
        }}
      >
        Manu Gin&oacute;bili
      </div>
      <div
        style={{
          font: "500 10px var(--font-mono)",
          color: "#6b655a",
          letterSpacing: "0.14em",
          marginBottom: "14px",
        }}
      >
        SHOOTING GUARD &middot; 2000s&ndash;2010s
      </div>
      <div
        style={{
          font: "600 16px var(--font-display)",
          color: "#2f6043",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        The Sixth-Man Operator
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(47,96,67,0.3)",
          marginBottom: "14px",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: "5px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <CardBadgeMobile label="CLUTCH" color="#bd5024" borderColor="rgba(189,80,36,0.45)" />
        <CardBadgeMobile label="QUIET LEADER" color="#356287" borderColor="rgba(54,98,135,0.5)" />
        <CardBadgeMobile label="ROLE CLARITY" color="#3a8054" borderColor="rgba(58,128,84,0.5)" />
      </div>
      <div
        style={{
          font: "400 12px/1.55 var(--font-body)",
          color: "#4a463d",
          marginBottom: "14px",
        }}
      >
        {SAMPLE_SUMMARY_MOBILE}
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(33,30,23,0.12)",
          marginBottom: "10px",
        }}
      />
      <div style={{ marginBottom: "12px" }}>
        {GRADES.map((g, i) => (
          <div
            key={g.label}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr 28px",
              gap: "10px",
              alignItems: "center",
              padding: "5px 0",
              borderBottom:
                i < GRADES.length - 1
                  ? "1px solid rgba(33,30,23,0.08)"
                  : undefined,
            }}
          >
            <div
              style={{
                font: "500 8px var(--font-mono)",
                color: g.color,
                letterSpacing: "0.14em",
              }}
            >
              {g.label}
            </div>
            <div
              style={{
                height: "4px",
                background: "rgba(33,30,23,0.08)",
                borderRadius: "1px",
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", width: g.width, background: g.color }} />
            </div>
            <div className="grade">
              <span className="ltr" style={{ fontSize: "15px", color: g.color }}>
                {g.letter}
              </span>
              <span
                className="suf"
                style={{ fontSize: "9px", width: "7px", color: g.color }}
              >
                {g.suffix}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          height: "1px",
          background: "rgba(33,30,23,0.12)",
          marginBottom: "12px",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "6px",
        }}
      >
        <CardStatMobile label="SEAS" value="12" />
        <CardStatMobile label="TEAMS" value="02" />
        <CardStatMobile label="PIVOTS" value="01" />
        <CardStatMobile label="STATUS" value="RFA" valueColor="#2f6043" />
      </div>
      </div>
    </div>
  );
}

function CardBadgeMobile({
  label,
  color,
  borderColor,
}: {
  label: string;
  color: string;
  borderColor: string;
}) {
  return (
    <span
      style={{
        font: "500 9px var(--font-mono)",
        letterSpacing: "0.14em",
        padding: "4px 7px",
        border: `1px solid ${borderColor}`,
        color,
        borderRadius: "3px",
      }}
    >
      {label}
    </span>
  );
}

function CardStatMobile({
  label,
  value,
  valueColor = "#211e17",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          font: "400 8px var(--font-mono)",
          color: "#a8a090",
          letterSpacing: "0.14em",
        }}
      >
        {label}
      </div>
      <div style={{ font: "500 13px var(--font-mono)", color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

// ---- drift fields (.scout-bg) ----------------------------------------------
// Each span sets its own font-size + the two animation durations/delays
// (scoutDrift, scoutBreathe) inline, exactly as in the export.

type DriftSpan = {
  left: string;
  top: string;
  fontSize: string;
  duration: string; // "<drift>,<breathe>"
  delay: string; // "<drift>,<breathe>"
  text: string;
  mark?: "x-mark" | "o-mark";
};

function driftStyle(s: DriftSpan): CSSProperties {
  return {
    left: s.left,
    top: s.top,
    fontSize: s.fontSize,
    animationDuration: s.duration,
    animationDelay: s.delay,
  };
}

function DriftField({ spans }: { spans: DriftSpan[] }) {
  return (
    <div className="scout-bg" aria-hidden="true">
      {spans.map((s, i) => (
        <span key={i} className={s.mark} style={driftStyle(s)}>
          {s.text}
        </span>
      ))}
    </div>
  );
}

function ScoutBgDesktop() {
  return <DriftField spans={DESKTOP_DRIFT} />;
}

function ScoutBgMobile() {
  return <DriftField spans={MOBILE_DRIFT} />;
}

// Desktop drift spans — export lines 122-182.
const DESKTOP_DRIFT: DriftSpan[] = [
  { left: "4%", top: "92%", fontSize: "14px", duration: "140s,17s", delay: "-12s,-3s", text: "+/-" },
  { left: "13%", top: "88%", fontSize: "18px", duration: "180s,22s", delay: "-55s,-8s", text: "TS%" },
  { left: "22%", top: "96%", fontSize: "12px", duration: "110s,14s", delay: "-30s,-11s", text: "7.2" },
  { left: "31%", top: "90%", fontSize: "16px", duration: "165s,19s", delay: "-78s,-5s", text: "PER" },
  { left: "40%", top: "94%", fontSize: "20px", duration: "200s,28s", delay: "-110s,-2s", text: "MLE" },
  { left: "50%", top: "89%", fontSize: "17px", duration: "155s,21s", delay: "-90s,-13s", text: "TOV" },
  { left: "60%", top: "96%", fontSize: "14px", duration: "175s,18s", delay: "-60s,-9s", text: "BPM" },
  { left: "69%", top: "91%", fontSize: "30px", duration: "210s,26s", delay: "-135s,-4s", text: "X", mark: "x-mark" },
  { left: "79%", top: "95%", fontSize: "13px", duration: "120s,16s", delay: "-45s,-14s", text: "WS" },
  { left: "90%", top: "90%", fontSize: "16px", duration: "150s,20s", delay: "-85s,-6s", text: "PG" },
  { left: "7%", top: "70%", fontSize: "24px", duration: "190s,27s", delay: "-100s,-1s", text: "A+" },
  { left: "18%", top: "74%", fontSize: "16px", duration: "170s,19s", delay: "-75s,-7s", text: "USG%" },
  { left: "29%", top: "69%", fontSize: "14px", duration: "140s,22s", delay: "-50s,-15s", text: "ORtg" },
  { left: "40%", top: "75%", fontSize: "18px", duration: "160s,24s", delay: "-95s,-11s", text: "eFG%" },
  { left: "51%", top: "70%", fontSize: "13px", duration: "115s,16s", delay: "-42s,-5s", text: "REB" },
  { left: "62%", top: "74%", fontSize: "15px", duration: "145s,20s", delay: "-68s,-13s", text: "MAX" },
  { left: "73%", top: "71%", fontSize: "28px", duration: "205s,29s", delay: "-118s,-2s", text: "O", mark: "o-mark" },
  { left: "84%", top: "76%", fontSize: "14px", duration: "135s,18s", delay: "-58s,-10s", text: "STL" },
  { left: "93%", top: "71%", fontSize: "17px", duration: "185s,25s", delay: "-105s,-4s", text: "B-" },
  { left: "6%", top: "48%", fontSize: "18px", duration: "168s,21s", delay: "-82s,-12s", text: "SG" },
  { left: "17%", top: "52%", fontSize: "12px", duration: "108s,16s", delay: "-28s,-8s", text: "BLK" },
  { left: "28%", top: "49%", fontSize: "16px", duration: "152s,23s", delay: "-72s,-14s", text: "DRtg" },
  { left: "39%", top: "53%", fontSize: "30px", duration: "195s,28s", delay: "-112s,-7s", text: "X", mark: "x-mark" },
  { left: "50%", top: "48%", fontSize: "14px", duration: "142s,19s", delay: "-62s,-11s", text: "FA" },
  { left: "61%", top: "53%", fontSize: "17px", duration: "178s,24s", delay: "-98s,-5s", text: "PF" },
  { left: "72%", top: "49%", fontSize: "13px", duration: "118s,17s", delay: "-33s,-13s", text: "7.9" },
  { left: "83%", top: "53%", fontSize: "15px", duration: "158s,22s", delay: "-88s,-9s", text: "2-WAY" },
  { left: "93%", top: "48%", fontSize: "19px", duration: "188s,26s", delay: "-108s,-10s", text: "ROOKIE" },
  { left: "9%", top: "27%", fontSize: "14px", duration: "132s,20s", delay: "-48s,-6s", text: "9.4" },
  { left: "21%", top: "31%", fontSize: "18px", duration: "172s,23s", delay: "-86s,-8s", text: "B+" },
  { left: "32%", top: "26%", fontSize: "26px", duration: "200s,27s", delay: "-115s,-3s", text: "O", mark: "o-mark" },
  { left: "44%", top: "30%", fontSize: "16px", duration: "162s,22s", delay: "-78s,-11s", text: "+/-" },
  { left: "55%", top: "25%", fontSize: "14px", duration: "138s,19s", delay: "-55s,-5s", text: "TS%" },
  { left: "66%", top: "32%", fontSize: "17px", duration: "182s,25s", delay: "-103s,-7s", text: "PER" },
  { left: "77%", top: "27%", fontSize: "13px", duration: "116s,16s", delay: "-36s,-10s", text: "7.1" },
  { left: "88%", top: "31%", fontSize: "15px", duration: "148s,21s", delay: "-65s,-4s", text: "AST" },
  { left: "14%", top: "11%", fontSize: "13px", duration: "125s,15s", delay: "-38s,-9s", text: "8.8" },
  { left: "31%", top: "8%", fontSize: "16px", duration: "152s,20s", delay: "-64s,-7s", text: "VET MIN" },
  { left: "49%", top: "12%", fontSize: "12px", duration: "108s,17s", delay: "-30s,-4s", text: "6.5" },
  { left: "65%", top: "9%", fontSize: "17px", duration: "172s,24s", delay: "-88s,-11s", text: "CAP HOLD" },
  { left: "83%", top: "12%", fontSize: "14px", duration: "130s,18s", delay: "-52s,-6s", text: "SF" },
  { left: "2%", top: "60%", fontSize: "15px", duration: "147s,19s", delay: "-66s,-8s", text: "PPG" },
  { left: "26%", top: "62%", fontSize: "13px", duration: "121s,16s", delay: "-29s,-12s", text: "5.4" },
  { left: "47%", top: "64%", fontSize: "28px", duration: "198s,27s", delay: "-120s,-3s", text: "O", mark: "o-mark" },
  { left: "69%", top: "61%", fontSize: "14px", duration: "138s,21s", delay: "-54s,-9s", text: "ISO" },
  { left: "88%", top: "63%", fontSize: "16px", duration: "163s,23s", delay: "-83s,-5s", text: "8.1" },
  { left: "11%", top: "40%", fontSize: "13px", duration: "128s,17s", delay: "-44s,-11s", text: "C+" },
  { left: "34%", top: "42%", fontSize: "17px", duration: "174s,24s", delay: "-92s,-6s", text: "DREB" },
  { left: "57%", top: "39%", fontSize: "14px", duration: "133s,18s", delay: "-51s,-13s", text: "FT%" },
  { left: "80%", top: "41%", fontSize: "26px", duration: "201s,28s", delay: "-114s,-4s", text: "X", mark: "x-mark" },
  { left: "16%", top: "84%", fontSize: "15px", duration: "151s,20s", delay: "-71s,-7s", text: "RFA" },
  { left: "37%", top: "82%", fontSize: "13px", duration: "117s,16s", delay: "-33s,-10s", text: "6.9" },
  { left: "58%", top: "85%", fontSize: "16px", duration: "168s,22s", delay: "-87s,-5s", text: "ELO" },
  { left: "78%", top: "83%", fontSize: "14px", duration: "142s,19s", delay: "-59s,-12s", text: "B" },
  { left: "24%", top: "18%", fontSize: "14px", duration: "136s,18s", delay: "-49s,-8s", text: "PIE" },
  { left: "53%", top: "16%", fontSize: "18px", duration: "179s,25s", delay: "-101s,-6s", text: "A-" },
  { left: "72%", top: "19%", fontSize: "13px", duration: "124s,17s", delay: "-37s,-11s", text: "7.6" },
  { left: "42%", top: "88%", fontSize: "24px", duration: "193s,26s", delay: "-107s,-3s", text: "X", mark: "x-mark" },
  { left: "64%", top: "45%", fontSize: "15px", duration: "158s,21s", delay: "-79s,-9s", text: "MIN" },
  { left: "5%", top: "34%", fontSize: "14px", duration: "130s,20s", delay: "-46s,-7s", text: "TO" },
  { left: "96%", top: "58%", fontSize: "13px", duration: "120s,16s", delay: "-26s,-13s", text: "G" },
];

// Mobile drift spans — export lines 475-494.
const MOBILE_DRIFT: DriftSpan[] = [
  { left: "6%", top: "94%", fontSize: "13px", duration: "130s,17s", delay: "-10s,-3s", text: "+/-" },
  { left: "24%", top: "90%", fontSize: "16px", duration: "170s,22s", delay: "-55s,-8s", text: "TS%" },
  { left: "44%", top: "96%", fontSize: "11px", duration: "105s,14s", delay: "-28s,-11s", text: "7.2" },
  { left: "64%", top: "91%", fontSize: "15px", duration: "160s,19s", delay: "-76s,-5s", text: "PER" },
  { left: "84%", top: "95%", fontSize: "18px", duration: "195s,27s", delay: "-108s,-2s", text: "MLE" },
  { left: "8%", top: "72%", fontSize: "22px", duration: "180s,26s", delay: "-92s,-7s", text: "A+" },
  { left: "30%", top: "76%", fontSize: "13px", duration: "125s,15s", delay: "-38s,-9s", text: "TOV" },
  { left: "52%", top: "71%", fontSize: "26px", duration: "200s,29s", delay: "-125s,-5s", text: "X", mark: "x-mark" },
  { left: "74%", top: "77%", fontSize: "14px", duration: "148s,21s", delay: "-68s,-12s", text: "WS" },
  { left: "12%", top: "52%", fontSize: "15px", duration: "152s,23s", delay: "-72s,-6s", text: "USG%" },
  { left: "38%", top: "48%", fontSize: "13px", duration: "122s,18s", delay: "-45s,-8s", text: "REB" },
  { left: "62%", top: "53%", fontSize: "24px", duration: "192s,27s", delay: "-110s,-2s", text: "O", mark: "o-mark" },
  { left: "84%", top: "49%", fontSize: "14px", duration: "135s,19s", delay: "-55s,-9s", text: "STL" },
  { left: "10%", top: "30%", fontSize: "13px", duration: "118s,21s", delay: "-38s,-13s", text: "MAX" },
  { left: "36%", top: "26%", fontSize: "17px", duration: "172s,24s", delay: "-88s,-11s", text: "DRtg" },
  { left: "60%", top: "31%", fontSize: "12px", duration: "108s,17s", delay: "-30s,-4s", text: "6.5" },
  { left: "82%", top: "27%", fontSize: "16px", duration: "152s,20s", delay: "-64s,-7s", text: "B+" },
  { left: "18%", top: "11%", fontSize: "14px", duration: "130s,18s", delay: "-52s,-6s", text: "VET MIN" },
  { left: "50%", top: "9%", fontSize: "12px", duration: "108s,17s", delay: "-30s,-4s", text: "9.1" },
  { left: "76%", top: "12%", fontSize: "17px", duration: "172s,24s", delay: "-88s,-11s", text: "SF" },
];
