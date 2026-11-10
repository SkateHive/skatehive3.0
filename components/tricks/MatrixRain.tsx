"use client";

import { useEffect, useRef } from "react";

// Falling-glyph backdrop, ported from the mobile app's MatrixRain.
// Canvas instead of one DOM node per column: cheap, and it fills whatever box it sits in.
const GLYPHS = "アカサタナハマヤラワabcdef0123456789ｦｧｨｩｪｫｬｭｮｯ$#@%&";
const COL_WIDTH = 22;
const LINE_H = 18;
const FRAME_MS = 70;

interface Props {
  color: string;
  opacity?: number;
}

export default function MatrixRain({ color, opacity = 0.22 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let drops: number[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(1, Math.floor(width / COL_WIDTH));
      drops = Array.from({ length: cols }, () => -Math.floor(Math.random() * (height / LINE_H)));
    };

    const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.font = `16px monospace`;
      ctx.textAlign = "center";
      for (let c = 0; c < drops.length; c++) {
        for (let y = LINE_H; y < height; y += LINE_H) {
          if (Math.random() < 0.35) ctx.fillText(glyph(), c * COL_WIDTH + COL_WIDTH / 2, y);
        }
      }
    };

    const step = () => {
      // Fade the previous frame instead of clearing it, which leaves the trails.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      ctx.font = `16px monospace`;
      ctx.textAlign = "center";
      for (let c = 0; c < drops.length; c++) {
        const y = drops[c] * LINE_H;
        if (y > 0) ctx.fillText(glyph(), c * COL_WIDTH + COL_WIDTH / 2, y);
        drops[c] = y > height && Math.random() > 0.95 ? 0 : drops[c] + 1;
      }
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawStatic();
    });
    ro.observe(canvas);

    if (reduceMotion) {
      drawStatic();
      return () => ro.disconnect();
    }

    const id = setInterval(step, FRAME_MS);
    return () => {
      clearInterval(id);
      ro.disconnect();
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
