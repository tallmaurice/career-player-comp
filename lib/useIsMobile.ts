"use client";

import { useEffect, useState } from "react";

// =============================================================================
// useIsMobile — shared responsive breakpoint hook
// One source of truth so every screen flips desktop <-> mobile at the SAME
// width, LIVE as the window resizes (not just on first load). Uses a matchMedia
// "change" listener at <=767px so dragging a desktop window narrow crosses into
// the mobile artboard layout the moment it passes the 768px line.
//
// SSR-safe: there's no `window` on the server, so we default to false (desktop)
// and correct on mount inside useEffect. The first client paint may briefly show
// desktop before the effect runs, which matches the prior per-component pattern.
//
// Mirrors the working local hook previously in OptionalText.tsx, just promoted
// to a shared module and moved from 480px to the 768px cutover.
// =============================================================================

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
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
