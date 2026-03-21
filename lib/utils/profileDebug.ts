/**
 * Profile page debug logging — only active in development.
 * Tracks component mounts, unmounts, renders, and data fetches.
 *
 * Usage:
 *   const debug = useProfileDebug("ComponentName");
 *   // Logs mount/unmount automatically
 *   debug.log("fetching data", { username });
 *   debug.render({ viewMode, postCount: posts.length });
 */

import { useEffect, useRef } from "react";

const IS_DEV = process.env.NODE_ENV === "development";
const PROFILE_DEBUG = IS_DEV; // flip to false to silence all profile logs

const COLORS: Record<string, string> = {
  mount: "color: #8aff00",      // green — mount
  unmount: "color: #ff4444",    // red — unmount
  render: "color: #888",        // gray — render
  fetch: "color: #44aaff",      // blue — data fetch
  tab: "color: #ffaa00",        // orange — tab switch
  warn: "color: #ff8800",       // orange — warning
  info: "color: #aaaaaa",       // light gray — info
};

function tag(component: string, type: keyof typeof COLORS, msg: string, data?: any) {
  if (!PROFILE_DEBUG) return;
  const style = COLORS[type] || COLORS.info;
  if (data !== undefined) {
    console.log(`%c[${component}] ${msg}`, style, data);
  } else {
    console.log(`%c[${component}] ${msg}`, style);
  }
}

export function useProfileDebug(component: string) {
  const renderCount = useRef(0);
  renderCount.current++;

  // Mount / unmount
  useEffect(() => {
    tag(component, "mount", `mounted (render #${renderCount.current})`);
    return () => {
      tag(component, "unmount", "unmounted");
    };
  }, [component]);

  // Log render count (only on re-renders, not first)
  useEffect(() => {
    if (renderCount.current > 1) {
      tag(component, "render", `re-render #${renderCount.current}`);
    }
  });

  return {
    log: (msg: string, data?: any) => tag(component, "info", msg, data),
    fetch: (msg: string, data?: any) => tag(component, "fetch", msg, data),
    tab: (msg: string, data?: any) => tag(component, "tab", msg, data),
    warn: (msg: string, data?: any) => tag(component, "warn", msg, data),
    renderCount: renderCount.current,
  };
}

/** Simple log without hook (for non-component code) */
export function profileLog(component: string, msg: string, data?: any) {
  tag(component, "info", msg, data);
}
