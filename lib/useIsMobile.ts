"use client";

import { useEffect, useState } from "react";

// =============================================================================
// useIsMobile — shared responsive breakpoint hook
// One source of truth so every screen flips desktop <-> mobile at the SAME
// width, LIVE as the window resizes (not just on first load). Uses a matchMedia
// "change" listener at <=767px so dragging a desktop window narrow crosses into
// the mobile artboard layout the moment it passes the 768px line.
//
// SSR-safe: there's no `window` on the server, so the lazy initializer falls
// back to false (desktop) there; on the client it reads the media query on the
// first render, so phones paint the mobile layout immediately (no one-frame
// desktop flash while waiting for the effect). The consumers of this hook all
// mount client-side after interaction, so there's no server HTML to mismatch.
//
// Mirrors the working local hook previously in OptionalText.tsx, just promoted
// to a shared module and moved from 480px to the 768px cutover.
// =============================================================================

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export default useIsMobile;
