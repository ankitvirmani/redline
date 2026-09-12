"use client";

import { useEffect, useRef } from "react";

/* Redline landing page: the flag-to-sentence link.
   Ported from landing/app.js. Same behaviour, same class names, same
   selectors. The page's server-rendered markup is already the correct
   resting state, so with JavaScript off nothing here is missed. */
export default function LandingRuntime() {
  /* Survives a StrictMode double-effect, so the load-time snap plays once. */
  const hasSnapped = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add("js");

    const stage = document.getElementById("stage");
    const wires = document.getElementById("wires");
    const flags = Array.prototype.slice.call(
      document.querySelectorAll(".flag"),
    ) as HTMLElement[];
    const chips = document.querySelector(".chips");
    if (!stage || !wires || !flags.length) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1101px)");

    function sourceFor(flag: HTMLElement) {
      return document.getElementById("src-" + flag.dataset.flag);
    }

    function barOf(flag: HTMLElement) {
      return flag.querySelector(".flag__bar") as HTMLElement | null;
    }

    /* One ink line from the open flag's bar to the sentence it quotes. */
    function drawWire(flag: HTMLElement) {
      if (!stage || !wires) return;
      wires.innerHTML = "";
      if (!wide.matches) return;
      const src = sourceFor(flag);
      const bar = barOf(flag);
      if (!src || !bar) return;

      const doc = document.querySelector(".doc");
      if (!doc) return;
      const base = stage.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const s = src.getBoundingClientRect();
      const d = doc.getBoundingClientRect();
      if (!s.height) return;

      /* The line lives in the gutter: it never crosses a word of the document. */
      const x1 = b.left - base.left;
      const y1 = b.top - base.top + b.height / 2;
      const lines = src.getClientRects();
      let far = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.right > far) far = line.right;
      }
      const x2 = Math.min(far, d.right) - base.left + 8;
      const y2 = s.top - base.top + s.height / 2;
      if (x2 >= x1 - 12) return;
      const mid = x2 + (x1 - x2) / 2;

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        "M" + x1 + " " + y1 + " H" + mid + " V" + y2 + " H" + x2,
      );
      wires.appendChild(path);
    }

    function open(flag: HTMLElement) {
      flags.forEach(function (f) {
        const on = f === flag;
        f.classList.toggle("is-open", on);
        barOf(f)?.setAttribute("aria-expanded", String(on));
        const s = sourceFor(f);
        if (s) s.classList.toggle("is-active", on);
      });
      drawWire(flag);
    }

    const undo: Array<() => void> = [];

    flags.forEach(function (flag) {
      const bar = barOf(flag);
      if (!bar) return;
      const onBarClick = function () {
        if (flag.classList.contains("is-open")) return;
        open(flag);
      };
      bar.addEventListener("click", onBarClick);
      undo.push(() => bar.removeEventListener("click", onBarClick));
    });

    /* Selecting the sentence in the document works the other way round too. */
    flags.forEach(function (flag) {
      const src = sourceFor(flag);
      if (!src) return;
      src.style.cursor = "pointer";
      const onSrcClick = function () {
        open(flag);
        barOf(flag)?.focus();
      };
      src.addEventListener("click", onSrcClick);
      undo.push(() => src.removeEventListener("click", onSrcClick));
    });

    const initial =
      (document.querySelector(".flag.is-open") as HTMLElement | null) ??
      flags[0];
    if (initial) open(initial);

    let t: ReturnType<typeof setTimeout>;
    const onResize = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        const cur = document.querySelector(".flag.is-open") as HTMLElement | null;
        if (cur) drawWire(cur);
      }, 120);
    };
    window.addEventListener("resize", onResize);
    undo.push(() => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    });

    if (hasSnapped.current) {
      return () => undo.forEach((fn) => fn());
    }
    hasSnapped.current = true;

    /* The one authored moment: the bars and fragments snap onto the page. */
    if (calm.matches) {
      flags.forEach(function (f) {
        f.classList.add("is-snapped");
      });
      if (chips) chips.classList.add("is-snapped");
      return () => undo.forEach((fn) => fn());
    }

    let settle: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(function () {
      flags.forEach(function (flag, i) {
        const bar = barOf(flag);
        if (bar) bar.style.transitionDelay = 90 + i * 110 + "ms";
        flag.classList.add("is-snapped");
      });
      if (chips) chips.classList.add("is-snapped");
      settle = setTimeout(function () {
        flags.forEach(function (f) {
          const bar = barOf(f);
          if (bar) bar.style.transitionDelay = "";
        });
        const cur = document.querySelector(".flag.is-open") as HTMLElement | null;
        if (cur) drawWire(cur);
      }, 1000);
    });

    return () => {
      undo.forEach((fn) => fn());
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, []);

  return null;
}
