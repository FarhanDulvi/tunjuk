"use client";

/**
 * TubesBackground — neon "tubes" 3D effect (threejs-components, self-contained
 * build loaded at runtime from CDN). Original concept by Kevin Levron.
 *
 * Adapted for Tunjuk: the effect animates on its own and does NOT respond to
 * the real cursor. The library drives the tubes from `pointermove` events on
 * document.body, so we (1) swallow real (trusted) pointer events and (2)
 * dispatch synthetic ones along a looping path so the tubes weave by themselves.
 * Fixed Chutes-green palette on pure black; used as a band under the hero.
 */

import { useEffect, useRef, useState } from "react";

const CDN_URL =
  "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";

type TubesApp = {
  tubes: {
    setColors: (c: string[]) => void;
    setLightsColors: (c: string[]) => void;
  };
};

interface Props {
  className?: string;
}

export function TubesBackground({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Block real cursor input so the tubes ignore the mouse.
    const swallowReal = (e: PointerEvent) => {
      if (e.isTrusted) e.stopImmediatePropagation();
    };

    (async () => {
      if (!canvasRef.current) return;
      try {
        // Runtime CDN module — not resolved at build time.
        const mod = await import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */ CDN_URL
        );
        if (!mounted) return;
        const TubesCursor = mod.default as (
          canvas: HTMLCanvasElement,
          opts: unknown,
        ) => TubesApp;

        TubesCursor(canvasRef.current, {
          tubes: {
            colors: ["#3fbf7e", "#1f9d63", "#2f9e66"],
            lights: {
              intensity: 70,
              colors: ["#3fbf7e", "#1f9d63", "#63d297", "#2f8f5e"],
            },
          },
        });
        setLoaded(true);

        document.body.addEventListener("pointermove", swallowReal, {
          capture: true,
        });

        // Auto-pilot: a slow Lissajous path inside the canvas so the tubes
        // keep flowing without any user input.
        const start = performance.now();
        const drive = (now: number) => {
          raf = requestAnimationFrame(drive);
          const canvas = canvasRef.current;
          if (!canvas) return;
          const r = canvas.getBoundingClientRect();
          if (r.width === 0) return;
          const t = (now - start) / 1000;
          const x =
            r.left +
            r.width * (0.5 + 0.34 * Math.sin(t * 0.55) + 0.1 * Math.sin(t * 1.7));
          const y =
            r.top +
            r.height *
              (0.5 + 0.3 * Math.sin(t * 0.83 + 1.3) + 0.12 * Math.cos(t * 1.31));
          document.body.dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: x,
              clientY: y,
              bubbles: true,
            }),
          );
        };
        if (!reduced) raf = requestAnimationFrame(drive);
      } catch (err) {
        console.error("TubesBackground: failed to load effect", err);
      }
    })();

    return () => {
      mounted = false;
      if (raf) cancelAnimationFrame(raf);
      document.body.removeEventListener("pointermove", swallowReal, {
        capture: true,
      });
    };
  }, []);

  return (
    <div
      className={`pointer-events-none relative w-full overflow-hidden bg-black ${className ?? ""}`}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{
          touchAction: "none",
          // `screen` makes black pixels contribute nothing, so the canvas's
          // near-black ambient fill disappears against the black page (no
          // visible rectangle) while the bright tubes stay.
          mixBlendMode: "screen",
          // Feather edges too, so any bright glow near a border fades out.
          WebkitMaskImage:
            "radial-gradient(ellipse 94% 90% at 50% 50%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 94% 90% at 50% 50%, #000 60%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default TubesBackground;
