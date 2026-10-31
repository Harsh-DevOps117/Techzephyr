"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(node, { autoAlpha: 1, y: 0 });
      return;
    }
    const tween = gsap.fromTo(node, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" });
    return () => {
      tween.kill();
    };
  }, [path]);
  return <div ref={ref} data-page-transition="">{children}</div>;
}
