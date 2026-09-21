"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/skaters/geo";

export type GeolocationState = "idle" | "locating" | "ready" | "denied" | "unavailable";

/**
 * The browser's position, asked for only when the user presses a button.
 *
 * Deliberately not requested on mount: an unprompted permission dialog on page
 * load is the kind of thing people reflexively deny, which then costs the
 * feature the permission for good.
 */
export default function useGeolocation() {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [state, setState] = useState<GeolocationState>("idle");

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      return;
    }

    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin([position.coords.latitude, position.coords.longitude]);
        setState("ready");
      },
      (error) => {
        // PERMISSION_DENIED is the only case worth a distinct message: the
        // others are transient and "try again" is the same advice.
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  const clear = useCallback(() => {
    setOrigin(null);
    setState("idle");
  }, []);

  return { origin, state, locate, clear };
}
