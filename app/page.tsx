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
const TIP_URL =
  process.env.NEXT_PUBLIC_STRIPE_TIP_URL ??
  "https://buy.stripe.com/5kQ8wQbWO1FV1ydfzOcfK00";

const INITIAL: AppState = {
  screen: "landing",
  careerText: "",
  answers: {},
  result: null,
};

/** base64url-encode the comp so /api/card can render it without any storage.
 *  Runs only on the client (it builds the Results share URL after interaction). */
function encodeComp(comp: Comp): string {
  const json = JSON.stringify(comp);
  // UTF-8 safe base64 (handles é, ·, ñ, etc. in player names/prose), then URL-safe.
  const b64 = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    ),
  );
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function Page() {
  const [state, setState] = useState<AppState>(INITIAL);
  // 0..7 while in the quiz; which question is showing.
  const [qIndex, setQIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { comp?: Comp; error?: string }
        | null;

      if (stale()) return; // user went home mid-flight; drop the result silently

      if (!res.ok || !data?.comp) {
        await holdMin();
        if (stale()) return;
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
      setState((s) => ({ ...s, result: data.comp!, screen: "results" }));
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
          setQIndex((i) => i + 1);
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

  switch (state.screen) {
    case "landing":
      return (
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
      // If generation already failed, show the retry over the scouting room.
      if (error) {
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
            cardImageUrl={`/api/card?format=feed&data=${encodeComp(state.result)}`}
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
      For entertainment. Not affiliated with the NBA, WNBA, or any player.
    </div>
  );
}

// ---- friendly retry (generation failure) -----------------------------------
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
