"use client";

import { useEffect, useRef } from "react";

export default function CursorSpotlight() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip on touch devices — a spotlight you can't aim is just noise.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let rafId = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (outerRef.current) outerRef.current.style.opacity = "1";
      if (innerRef.current) innerRef.current.style.opacity = "1";
    };

    const onLeave = () => {
      if (outerRef.current) outerRef.current.style.opacity = "0";
      if (innerRef.current) innerRef.current.style.opacity = "0";
    };

    const tick = () => {
      // Eased follow for buttery motion
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      if (outerRef.current) {
        outerRef.current.style.transform = `translate3d(${currentX - 400}px, ${currentY - 400}px, 0)`;
      }
      if (innerRef.current) {
        innerRef.current.style.transform = `translate3d(${currentX - 140}px, ${currentY - 140}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div ref={outerRef} className="cursor-spotlight-outer" aria-hidden />
      <div ref={innerRef} className="cursor-spotlight-inner" aria-hidden />
    </>
  );
}
