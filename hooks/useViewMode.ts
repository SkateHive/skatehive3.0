"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const VIEW_MODES = ["grid", "list", "magazine", "videoparts", "snaps", "casts"] as const;
type ViewMode = typeof VIEW_MODES[number];

export default function useViewMode() {
    const router = useRouter();
    const isInitialMount = useRef(true);

    // Get the initial view mode from the URL
    const getInitialViewMode = (): ViewMode => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get("view") ?? '';
            if ((VIEW_MODES as readonly string[]).includes(viewParam)) {
                return viewParam as ViewMode;
            }
        }
        return "snaps";
    };

    const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        if (typeof window !== "undefined") {
            localStorage.setItem("profileViewMode", mode);
        }
    }, []);

    // When viewMode changes, update the URL (but not on initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.set('view', viewMode);
            const newUrl = `${window.location.pathname}?${params.toString()}`;
            
            // Use replaceState for magazine mode to avoid back button issues
            // Use pushState for other modes to maintain browsable history
            if (viewMode === 'magazine') {
                window.history.replaceState({}, '', newUrl);
            } else {
                window.history.replaceState({}, '', newUrl);
            }
        }
    }, [viewMode]);

    const closeMagazine = useCallback(() => {
        // Set view mode to default (snaps for profile pages)
        // The useEffect above will handle URL updates
        setViewMode('snaps');
    }, []);

    return {
        viewMode,
        handleViewModeChange,
        closeMagazine,
    };
}
