"use client";

import { useEffect, useState, useCallback } from "react";

export type BodyFont = "serif" | "sans" | "pixel";
export type BodyColor = "warm" | "neon" | "white";

export interface MagazineTweaks {
  bodyFont: BodyFont;
  bodyColor: BodyColor;
  dropCap: boolean;
  pullQuote: boolean;
  imageFrames: boolean;
  tightRhythm: boolean;
}

export const DEFAULT_TWEAKS: MagazineTweaks = {
  bodyFont: "serif",
  bodyColor: "warm",
  dropCap: true,
  pullQuote: true,
  imageFrames: true,
  tightRhythm: true,
};

const STORAGE_KEY = "skatehive:magazine-tweaks";
const SYNC_EVENT = "skatehive:magazine-tweaks:sync";

function readFromStorage(): MagazineTweaks {
  if (typeof window === "undefined") return DEFAULT_TWEAKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

export function useMagazineTweaks() {
  const [tweaks, setTweaks] = useState<MagazineTweaks>(DEFAULT_TWEAKS);

  useEffect(() => {
    setTweaks(readFromStorage());
    const sync = () => setTweaks(readFromStorage());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((partial: Partial<MagazineTweaks>) => {
    setTweaks((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(SYNC_EVENT));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {}
    setTweaks(DEFAULT_TWEAKS);
  }, []);

  return { tweaks, update, reset };
}
