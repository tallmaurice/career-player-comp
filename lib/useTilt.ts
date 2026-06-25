// =============================================================================
// Career Player Comp — useTilt: pointer-driven 3D tilt for the scouting card
//
// The card is meant to read like a physical artifact on a desk. By default the
// design ships a STATIC lean (.tilt-card { transform: rotateX(-5deg)
// rotateY(8deg) } in globals.css). This hook makes that lean react to the
// cursor: the card leans toward the pointer, then eases back to rest on leave.
//
// Usage (the markup the design already uses — a .tilt-wrap perspective parent
// around an inner .tilt-card):
//
//   const { wrapRef, cardRef } = useTilt();
//   <div className="tilt-wrap" ref={wrapRef}>
//     <div className="tilt-card paper-card" ref={cardRef}> ... </div>
//   </div>
//
// Design constraints honored here:
//   • Subtle and premium — rotation is clamped to MAX_DEG (~9°), not a spin.
//   • translateZ depth is untouched: we only set rotateX/rotateY on the card, so
//     the .layer-z1/2/3 children keep their own translateZ under preserve-3d.
//   • The CSS already carries `transition: transform 400ms ...` on .tilt-card,
//     so easing (including the snap-back to rest) is handled by CSS — we just
//     set/clear the transform.
//   • prefers-reduced-motion: no tilt at all; the static resting lean stays.
//   • Touch: touchmove drives the same tilt on mobile; touchend resets.
//
// Gyroscope (DeviceOrientation) is intentionally left out: it needs an
// iOS permission prompt and careful axis handling to not feel like a gimmick.
// TODO(maurice): add an optional gyro path if it can be made to feel calm.
// =============================================================================

import { useEffect, useRef } from "react";

// Max lean in each axis, in degrees. Kept small so the card reads as a leaning
// object, not a toy. The pointer at an edge maps to ~this much rotation.
const MAX_DEG = 9;

export interface TiltRefs {
  /** Attach to the .tilt-wrap perspective parent — listeners live here. */
  wrapRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the inner .tilt-card whose transform we drive. */
  cardRef: React.RefObject<HTMLDivElement | null>;
}

export function useTilt(): TiltRefs {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;

    // Respect reduced motion: leave the static resting lean from globals.css
    // and attach nothing.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    // Map a client point to a tilt and write it to the card. Offset is the
    // cursor's position relative to the wrap center, normalized to -0.5..0.5,
    // then scaled to ±MAX_DEG. Cursor right -> lean right (rotateY+); cursor
    // down -> top edge tips away (rotateX-).
    const applyTilt = (clientX: number, clientY: number) => {
      const r = wrap.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const px = (clientX - r.left) / r.width - 0.5; // -0.5 .. 0.5
      const py = (clientY - r.top) / r.height - 0.5; // -0.5 .. 0.5
      const rotY = px * (MAX_DEG * 2); // ±MAX_DEG
      const rotX = -py * (MAX_DEG * 2); // ±MAX_DEG
      // Only rotate — no translateZ here, so the .layer-z children keep their
      // own depth under the card's preserve-3d.
      card.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    };

    // Clear the inline transform so the .tilt-card CSS rule (the resting lean)
    // takes over again; the CSS transition eases the snap-back.
    const reset = () => {
      card.style.transform = "";
    };

    const onPointerMove = (e: PointerEvent) => applyTilt(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) applyTilt(t.clientX, t.clientY);
    };

    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", reset);
    wrap.addEventListener("touchmove", onTouchMove, { passive: true });
    wrap.addEventListener("touchend", reset);
    wrap.addEventListener("touchcancel", reset);

    return () => {
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", reset);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", reset);
      wrap.removeEventListener("touchcancel", reset);
      reset();
    };
  }, []);

  return { wrapRef, cardRef };
}
