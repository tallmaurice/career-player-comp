"use client";

// =============================================================================
// Career Player Comp — flow controller (the only stateful screen)
//
// Holds AppState (screen, careerText, answers, result) and renders exactly one
// presentational screen at a time, wiring each screen's callbacks per
// lib/types.ts. Flow:
//   landing -> upload -> quiz (8 Qs, one per screen, auto-advance on select)
//           -> optional9 -> optional10 -> loading -> results
//
// On entering `loading` it POSTs { careerText, answers } to /api/generate-comp,
// holds the loader a minimum ~3s for theater, then shows results (or a friendly
// retry on error). "Appeal Your Report" resets everything to landing.
//
// Privacy: nothing is persisted. The result lives in component state; the
// shareable card travels only as a base64url-encoded query param to /api/card
// (the user-downloaded PNG), never to storage.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, Comp, QuizAnswers } from "@/lib/types";
import {
  QUESTIONS,
  Q9_PROMPT,
  Q9_EXAMPLES,
  Q10_PROMPT,
  Q10_EXAMPLES,
} from "@/lib/types";

import Landing from "./components/Landing";
import CareerUpload from "./components/CareerUpload";
import QuizQuestion from "./components/QuizQuestion";
import OptionalText from "./components/OptionalText";
import ScoutingRoom from "./components/ScoutingRoom";
import Results from "./components/Results";

const TOTAL_QUESTIONS = QUESTIONS.length; // 8
const AUTO_ADVANCE_MS = 320; // brief pause so the "[ SELECTED ]" state registers
const MIN_LOADING_MS = 3000; // hold the scouting-room theater at least this long
const SKIP_URL = "https://buy.stripe.com/fZu8wQaOh9cL0Ooepb0Jq01";
const TIP_URL =
  process.env.NEXT_PUBLIC_STRIPE_TIP_URL ??
  "https://buy.stripe.com/3cIeVe09Ddt1dBadl70Jq00";

const INITIAL: AppState = {
  screen: "landing",
  careerText: "",
  answers: {},
  result: null,
};

export default function Page() {
  const [state, setState] = useState<AppState>(INITIAL);
  // 0..7 while in the quiz; which question is showing.
  const [qIndex, setQIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // When the global daily spend cap trips, the API returns reason:"daily_cap";
  // we render the branded "scouts are out" page instead of the retry screen.
  const [errorReason, setErrorReason] = useState<string | null>(null);

  // $2 skip-the-line pass: Stripe redirects back with ?paid=cs_... — capture
  // it (ref feeds the generate call; state shows the banner), then clean the URL.
  const paidRef = useRef<string | null>(null);
  const [paidBanner, setPaidBanner] = useState(false);
  useEffect(() => {
    // The pass must survive reloads/app-switches (mobile browsers kill pages
    // constantly), so it lives in localStorage until a report succeeds. A real
    // customer lost his $2 pass to exactly this on 7/7.
    const sid = new URLSearchParams(window.location.search).get("paid");
    if (sid && /^cs_[A-Za-z0-9_]+$/.test(sid)) {
      try {
        window.localStorage.setItem("cpc_pass", sid);
      } catch {}
      window.history.replaceState({}, "", window.location.pathname);
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("cpc_pass");
    } catch {}
    if (stored && /^cs_[A-Za-z0-9_]+$/.test(stored)) {
      paidRef.current = stored;
      setPaidBanner(true);
    }
  }, []);

  // Guard so React 18 StrictMode double-invoke doesn't fire two generations.
  const generatingRef = useRef(false);
  // Bumped on every reset/home so an in-flight generation that resolves AFTER
  // the user has gone home can't slam the screen back to results.
  const genTokenRef = useRef(0);

  const patch = useCallback(
    (p: Partial<AppState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  const reset = useCallback(() => {
    generatingRef.current = false;
    genTokenRef.current += 1; // invalidate any in-flight generation
    setError(null);
    setErrorReason(null);
    setQIndex(0);
    setState(INITIAL);
  }, []);

  // Top-left wordmark on every screen: abandon whatever's in flight and go home
  // with a clean slate (careerText, answers, result all cleared via INITIAL).
  const onHome = reset;

  // ---- the generation call, fired when we enter `loading` -------------------
  const runGeneration = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setError(null);
    setErrorReason(null);

    // Snapshot the token; if onHome/reset fires while we're awaiting, this
    // generation is stale and must not write any state when it resolves.
    const token = genTokenRef.current;
    const stale = () => genTokenRef.current !== token;

    const startedAt = Date.now();
    const holdMin = () => {
      const elapsed = Date.now() - startedAt;
      return elapsed >= MIN_LOADING_MS
        ? Promise.resolve()
        : new Promise<void>((r) => setTimeout(r, MIN_LOADING_MS - elapsed));
    };

    try {
      const res = await fetch("/api/generate-comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          careerText: state.careerText,
          answers: state.answers,
          paidSession: paidRef.current,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { comp?: Comp; error?: string; reason?: string; scouted?: number }
        | null;

      if (stale()) return; // user went home mid-flight; drop the result silently

      if (!res.ok || !data?.comp) {
        await holdMin();
        if (stale()) return;
        setErrorReason(data?.reason ?? null);
        setError(
          data?.error ??
            "The scout couldn't finish the report. Take another shot.",
        );
        generatingRef.current = false;
        return;
      }

      await holdMin(); // keep the scouting room up for the full beat
      if (stale()) return;
      generatingRef.current = false;
      if (paidRef.current) {
        // Pass was burned server-side on this success; retire it locally too.
        try {
          window.localStorage.removeItem("cpc_pass");
        } catch {}
        paidRef.current = null;
        setPaidBanner(false);
      }
      setState((s) => ({
        ...s,
        result: data.comp!,
        scouted: data.scouted,
        screen: "results",
      }));
    } catch {
      await holdMin();
      if (stale()) return;
      setError("Something dropped on the way to the front office. Try again.");
      generatingRef.current = false;
    }
  }, [state.careerText, state.answers]);

  useEffect(() => {
    if (state.screen === "loading") {
      void runGeneration();
    }
    // re-run only when we transition into loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen]);

  // Reset scroll to the top on every screen change. Without this the SPA keeps
  // the previous screen's scroll offset, so a new screen appears already
  // scrolled down (most visible on mobile). Keyed on the quiz index too (each
  // question is its own view) and on `error` (the retry screen renders while
  // `screen` stays "loading", so a screen-only key would miss it).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen, qIndex, error]);

  // ---- per-screen handlers --------------------------------------------------

  const onStart = useCallback(() => {
    setQIndex(0);
    patch({ screen: "upload" });
  }, [patch]);

  const onUploadContinue = useCallback(
    (careerText: string) => {
      setQIndex(0);
      patch({ careerText, screen: "quiz" });
    },
    [patch],
  );

  const onSelectAnswer = useCallback(
    (option: string) => {
      const key = `q${qIndex + 1}` as keyof QuizAnswers;
      setState((s) => ({ ...s, answers: { ...s.answers, [key]: option } }));
      // auto-advance after a brief beat (BACK still works)
      window.setTimeout(() => {
        if (qIndex + 1 < TOTAL_QUESTIONS) {
          // Absolute, not functional: a double-tap fires two timers and both
          // must land on the SAME next question (was skipping/crashing).
          setQIndex(qIndex + 1);
        } else {
          setQIndex(0);
          setState((s) => ({ ...s, screen: "optional9" }));
        }
      }, AUTO_ADVANCE_MS);
    },
    [qIndex],
  );

  const onQuizBack = useCallback(() => {
    if (qIndex === 0) {
      patch({ screen: "upload" });
    } else {
      setQIndex((i) => i - 1);
    }
  }, [qIndex, patch]);

  const setOptional = useCallback(
    (which: 9 | 10, value: string) => {
      const key = which === 9 ? "q9" : "q10";
      const v = value.trim();
      setState((s) => ({
        ...s,
        answers: { ...s.answers, [key]: v.length ? v : undefined },
      }));
    },
    [],
  );

  // ---- render ---------------------------------------------------------------

  // Paid-pass reassurance strip: shows after the Stripe redirect until the
  // report generates, so the buyer knows the $2 registered.
  const banner = paidBanner ? (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--green)",
        color: "#f1ece0",
        font: "600 12px var(--font-mono)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textAlign: "center",
        padding: "9px 12px",
      }}
    >
      Paid pass active &mdash; the scout is ready when you are
    </div>
  ) : null;

  const screenFor = (node: React.ReactNode) => (
    <>
      {banner}
      {node}
    </>
  );

  switch (state.screen) {
    case "landing":
      return screenFor(
        <>
          <Landing onStart={onStart} onHome={onHome} />
          <Disclaimer />
        </>
      );

    case "upload":
      return (
        <CareerUpload
          onContinue={onUploadContinue}
          onHome={onHome}
          initialText={state.careerText}
        />
      );

    case "quiz": {
      const key = `q${qIndex + 1}` as keyof QuizAnswers;
      return (
        <QuizQuestion
          index={qIndex}
          total={TOTAL_QUESTIONS}
          question={QUESTIONS[qIndex]}
          selected={state.answers[key]}
          onSelect={onSelectAnswer}
          onBack={onQuizBack}
          onHome={onHome}
        />
      );
    }

    case "optional9":
      return (
        <OptionalText
          which={9}
          prompt={Q9_PROMPT}
          placeholder={Q9_EXAMPLES[0]}
          examples={Q9_EXAMPLES}
          value={state.answers.q9}
          onContinue={(v) => {
            setOptional(9, v);
            patch({ screen: "optional10" });
          }}
          onSkip={() => {
            setOptional(9, "");
            patch({ screen: "optional10" });
          }}
          onBack={() => {
            setQIndex(TOTAL_QUESTIONS - 1);
            patch({ screen: "quiz" });
          }}
          onHome={onHome}
        />
      );

    case "optional10":
      return (
        <OptionalText
          which={10}
          prompt={Q10_PROMPT}
          placeholder={Q10_EXAMPLES[0]}
          examples={Q10_EXAMPLES}
          value={state.answers.q10}
          onContinue={(v) => {
            setOptional(10, v);
            patch({ screen: "loading" });
          }}
          onSkip={() => {
            setOptional(10, "");
            patch({ screen: "loading" });
          }}
          onBack={() => patch({ screen: "optional9" })}
          onHome={onHome}
        />
      );

    case "loading":
      // If generation already failed, show the retry over the scouting room —
      // unless the GLOBAL daily cap tripped, which retrying won't fix. Then show
      // the branded "scouts are out for the day" page (tip + sponsor).
      if (error) {
        if (errorReason === "daily_cap") {
          return <ScoutsOut tipUrl={TIP_URL} skipUrl={SKIP_URL} onReset={reset} />;
        }
        return (
          <RetryScreen
            message={error}
            onRetry={() => {
              setError(null); // back to the scouting room; effect-free re-fire
              void runGeneration();
            }}
            onReset={reset}
          />
        );
      }
      return <ScoutingRoom />;

    case "results":
      if (!state.result) {
        // defensive: never reached in normal flow
        return <RetryScreen message="The report went missing." onRetry={reset} onReset={reset} />;
      }
      return (
        <>
          <Results
            comp={state.result}
            onAppeal={reset}
            onHome={onHome}
            tipUrl={TIP_URL}
            scoutedNumber={state.scouted}
          />
          <Disclaimer />
        </>
      );
  }
}

// ---- small footer disclaimer (landing + results) ---------------------------
function Disclaimer() {
  return (
    <div
      className="paper-bg"
      style={{
        textAlign: "center",
        padding: "0 22px 28px",
        font: "400 11px var(--font-mono)",
        color: "var(--faint)",
        letterSpacing: "0.14em",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 18,
          marginBottom: 12,
        }}
      >
        <a
          href="https://x.com/careerplayrcomp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Career Player Comp on X"
          className="cpc-home"
          style={{ display: "inline-flex", color: "var(--ink)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          href="https://instagram.com/careerplayercomp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Career Player Comp on Instagram"
          className="cpc-home"
          style={{ display: "inline-flex", color: "var(--ink)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5.5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
      For entertainment. Not affiliated with the NBA, WNBA, or any player.
      <div style={{ marginTop: 8 }}>
        <a href="/privacy" style={{ color: "var(--faint)" }}>
          Privacy
        </a>{" "}
        ·{" "}
        <a href="/terms" style={{ color: "var(--faint)" }}>
          Terms
        </a>{" "}
        · © 2026 Drapetomania LLC
      </div>
    </div>
  );
}

// ---- friendly retry (generation failure) -----------------------------------
// The branded "scouts are out for the day" page — shown when the GLOBAL daily
// spend cap trips. Honest scarcity in the scout's voice (every report is a real
// AI read, which costs real money), converting to the tip jar ("another round")
// and the #1 sponsor inventory ("keep the room open"). Not a fake apology.
function ScoutsOut({
  tipUrl,
  skipUrl,
  onReset,
}: {
  tipUrl: string;
  skipUrl: string;
  onReset: () => void;
}) {
  const sponsorUrl =
    "mailto:hello@careerplayercomp.com?subject=Sponsoring%20the%20scouting%20room";
  // Pull the live "careers scouted" total for social proof — a sponsor (or big
  // account) hitting this page mid-spike sees the demand. Hidden at 0 / on
  // failure so it never shows a bare "0".
  const [scoutedTotal, setScoutedTotal] = useState<number | null>(null);
  // Today's count: the sponsor-facing velocity number. On a viral day, "N today
  // before the budget ran out" is the whole pitch — demand you can timestamp.
  const [scoutedToday, setScoutedToday] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/scouted")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { total?: number; today?: number } | null) => {
        if (!live || !d) return;
        if (typeof d.total === "number" && d.total > 0) setScoutedTotal(d.total);
        if (typeof d.today === "number" && d.today > 0) setScoutedToday(d.today);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <div
      className="paper-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          font: "500 11px var(--font-mono)",
          color: "var(--green)",
          letterSpacing: "0.3em",
          marginBottom: 22,
        }}
      >
        [ SCOUTS ARE OUT ]
      </div>
      <div
        style={{
          font: "600 clamp(28px, 6vw, 38px) var(--font-display)",
          color: "var(--ink)",
          textTransform: "uppercase",
          letterSpacing: "-0.005em",
          lineHeight: 1.05,
          maxWidth: 560,
          marginBottom: 20,
        }}
      >
        The free scouts are out for the day.
      </div>
      <p
        style={{
          font: "400 15px/1.6 var(--font-body)",
          color: "var(--muted, #5a5347)",
          maxWidth: 480,
          marginBottom: 30,
        }}
      >
        Every report here is a real AI scout reading your whole career, not a
        template spitting out a name. That costs real money every run, and
        today&rsquo;s free scouting budget is spent. The free room reopens at
        8am Eastern.
      </p>

      {scoutedTotal !== null && (
        <div style={{ marginBottom: 30, textAlign: "center" }}>
          <div
            style={{
              font: "700 clamp(34px, 7vw, 46px) var(--font-display)",
              color: "var(--green)",
              lineHeight: 1,
            }}
          >
            {Math.min(
              scoutedToday ?? scoutedTotal,
              scoutedTotal,
            ).toLocaleString()}
          </div>
          <div
            style={{
              font: "500 10px var(--font-mono)",
              color: "var(--muted, #5a5347)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginTop: 8,
            }}
          >
            {scoutedToday !== null
              ? "careers scouted today alone"
              : "careers scouted"}
          </div>
          {scoutedToday !== null && (
            <div
              style={{
                font: "500 10px var(--font-mono)",
                color: "var(--muted, #5a5347)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginTop: 10,
              }}
            >
              {scoutedTotal.toLocaleString()} all-time · demand outran the budget
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <a
          href={skipUrl}
          className="cta-green"
          style={{
            background: "var(--green)",
            color: "#f1ece0",
            padding: "15px 18px",
            borderRadius: 10,
            font: "600 15px var(--font-body)",
            textDecoration: "none",
          }}
        >
          Get your report anyway &mdash; $2
        </a>
        <div
          style={{
            font: "400 12.5px/1.5 var(--font-body)",
            color: "var(--muted, #5a5347)",
            marginBottom: 16,
          }}
        >
          Two bucks covers your read and helps keep the free room open for the
          next person.
        </div>
        <a
          href={sponsorUrl}
          className="cta-green"
          style={{
            background: "transparent",
            border: "1.5px solid var(--green)",
            color: "var(--green)",
            textDecoration: "none",
            padding: "17px 24px",
            font: "700 14px var(--font-body)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderRadius: 4,
          }}
        >
          Sponsor Career Player Comp
        </a>
        <div style={{ font: "400 12.5px/1.5 var(--font-body)", color: "var(--muted, #5a5347)", marginBottom: 16 }}>
          If this is in front of your audience right now, it&rsquo;s working. It
          costs real money to keep the scouts reading careers around the clock.
          Put your brand on the scouting room and keep it open.
        </div>

        <a
          href={tipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ghost-ln"
          style={{
            background: "transparent",
            border: "1px solid rgba(33,30,23,0.22)",
            color: "var(--ink)",
            textDecoration: "none",
            padding: "13px 24px",
            font: "600 12px var(--font-body)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            borderRadius: 4,
          }}
        >
          Or tip the scouts
        </a>
        <div style={{ font: "400 12px/1.5 var(--font-body)", color: "var(--muted, #5a5347)" }}>
          A tip won&rsquo;t reopen the room today. It just helps cover the bill so
          this can keep running.
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          font: "500 11px var(--font-mono)",
          color: "var(--muted, #5a5347)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          lineHeight: 2,
        }}
      >
        The room is closed. The tape is still running:
        <br />
        <a
          href="https://x.com/careerplayrcomp"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}
        >
          @careerplayrcomp on X
        </a>
        {" \u00b7 "}
        <a
          href="https://instagram.com/careerplayercomp"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}
        >
          @careerplayercomp on IG
        </a>
      </div>

      <button
        type="button"
        onClick={onReset}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted, #5a5347)",
          font: "500 12px var(--font-body)",
          letterSpacing: "0.04em",
          marginTop: 34,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Come back tomorrow. Head home.
      </button>
    </div>
  );
}

function RetryScreen({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className="paper-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          font: "500 11px var(--font-mono)",
          color: "var(--green)",
          letterSpacing: "0.3em",
          marginBottom: 24,
        }}
      >
        [ SCOUTING ROOM ]
      </div>
      <div
        style={{
          font: "600 30px var(--font-display)",
          color: "var(--ink)",
          textTransform: "uppercase",
          letterSpacing: "-0.005em",
          maxWidth: 520,
          marginBottom: 28,
        }}
      >
        {message}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          className="cta-green"
          onClick={onRetry}
          style={{
            background: "var(--green)",
            color: "#f1ece0",
            border: "none",
            padding: "16px 28px",
            font: "600 13px var(--font-body)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderRadius: 4,
          }}
        >
          Try Again &nbsp;&rarr;
        </button>
        <button
          type="button"
          className="ghost-ln"
          onClick={onReset}
          style={{
            background: "transparent",
            border: "1px solid rgba(33,30,23,0.2)",
            color: "var(--ink)",
            padding: "16px 28px",
            font: "600 13px var(--font-body)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderRadius: 4,
          }}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
