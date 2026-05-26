"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

type Detent = "peek" | "mid" | "full";

interface MobileMapSheetProps {
  children: React.ReactNode;
  /** Initial detent. Defaults to "peek" so the map is the dominant element. */
  initialDetent?: Detent;
  /** Visible height of the sheet for each detent, as a vh percentage. */
  detents?: Record<Detent, number>;
  /**
   * Fires when the user pulls the sheet to a new detent. Useful if the
   * parent wants to react (e.g. resize the map so spots aren't hidden
   * behind the sheet).
   */
  onDetentChange?: (detent: Detent) => void;
}

const DEFAULT_DETENTS: Record<Detent, number> = {
  peek: 22, // header + 1 card peek
  mid: 55, // half the screen
  full: 88, // nearly full-screen, small map sliver at top
};

/**
 * Airbnb-style draggable bottom sheet for the mobile /map view.
 *
 * Three detents (peek/mid/full). Drag the handle (or anywhere in the
 * header) to move freely between them; releasing snaps to the nearest.
 * Below the header the inner content scrolls vertically — touchmove on
 * the scroll area only drags the sheet when the scroller is at the very
 * top, so the UX matches the iOS bottom-sheet convention.
 */
export default function MobileMapSheet({
  children,
  initialDetent = "peek",
  detents = DEFAULT_DETENTS,
  onDetentChange,
}: MobileMapSheetProps) {
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const [dragHeightVh, setDragHeightVh] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ y: number; heightVh: number; vh: number } | null>(null);

  const visibleVh = dragHeightVh ?? detents[detent];

  const snapTo = useCallback(
    (vh: number) => {
      // Pick the detent whose vh is closest to where the user released.
      const entries = (Object.entries(detents) as [Detent, number][]).sort(
        (a, b) => Math.abs(a[1] - vh) - Math.abs(b[1] - vh)
      );
      const next = entries[0][0];
      setDetent(next);
      setDragHeightVh(null);
      onDetentChange?.(next);
    },
    [detents, onDetentChange]
  );

  // -------- Touch handlers (used on the handle area) --------

  const beginDrag = useCallback(
    (clientY: number) => {
      const vh = window.innerHeight;
      dragStartRef.current = {
        y: clientY,
        heightVh: visibleVh,
        vh,
      };
    },
    [visibleVh]
  );

  const onMove = useCallback((clientY: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    const deltaPx = start.y - clientY; // upward = positive
    const deltaVh = (deltaPx / start.vh) * 100;
    const next = Math.max(
      detents.peek,
      Math.min(detents.full, start.heightVh + deltaVh)
    );
    setDragHeightVh(next);
  }, [detents.full, detents.peek]);

  const endDrag = useCallback(() => {
    if (!dragStartRef.current) return;
    const finalVh = dragHeightVh ?? detents[detent];
    dragStartRef.current = null;
    snapTo(finalVh);
  }, [dragHeightVh, detent, detents, snapTo]);

  // Touch events on the handle/header
  const onHandleTouchStart = (e: React.TouchEvent) => beginDrag(e.touches[0].clientY);
  const onHandleTouchMove = (e: React.TouchEvent) => onMove(e.touches[0].clientY);
  const onHandleTouchEnd = endDrag;

  // Touch events on the content area — only drag when the scroller is at top.
  const contentTouchStart = (e: React.TouchEvent) => {
    const scroller = scrollerRef.current;
    if (scroller && scroller.scrollTop > 0) {
      // Normal scroll — let the browser handle it.
      dragStartRef.current = null;
      return;
    }
    beginDrag(e.touches[0].clientY);
  };
  const contentTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    const dy = dragStartRef.current.y - e.touches[0].clientY;
    // Only treat as a sheet drag while pulling down or while not yet scrolling.
    if (dy < 0 || (scrollerRef.current && scrollerRef.current.scrollTop === 0)) {
      onMove(e.touches[0].clientY);
    }
  };
  const contentTouchEnd = endDrag;

  // Mouse drag (for desktop dev/test convenience — phones use touch only).
  useEffect(() => {
    if (!dragStartRef.current) return;
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const onMouseUp = () => endDrag();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMove, endDrag]);

  return (
    <Box
      ref={sheetRef}
      position="fixed"
      left={0}
      right={0}
      bottom={0}
      zIndex={500}
      height={`${visibleVh}vh`}
      bg="rgba(10,10,10,0.96)"
      borderTop="1px solid"
      borderColor="primary"
      borderTopRadius="16px"
      boxShadow="0 -12px 32px rgba(0,0,0,0.5)"
      style={{
        transition: dragStartRef.current ? "none" : "height 0.22s ease",
        backdropFilter: "blur(10px)",
        // No bounce on touch: container is fixed; inner content scrolls.
        touchAction: "none",
      }}
      display="flex"
      flexDirection="column"
    >
      {/* Drag handle */}
      <Box
        py={2}
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onMouseDown={(e) => beginDrag(e.clientY)}
        cursor="grab"
        sx={{ "&:active": { cursor: "grabbing" } }}
        flexShrink={0}
      >
        <Box
          mx="auto"
          w="40px"
          h="4px"
          borderRadius="full"
          bg="rgba(167,255,0,0.5)"
        />
      </Box>

      {/* Scrollable content */}
      <Box
        ref={scrollerRef}
        flex="1"
        overflowY="auto"
        onTouchStart={contentTouchStart}
        onTouchMove={contentTouchMove}
        onTouchEnd={contentTouchEnd}
        style={{ touchAction: "pan-y" }}
        sx={{
          "::-webkit-scrollbar": { width: "6px" },
          "::-webkit-scrollbar-thumb": {
            background: "rgba(167,255,0,0.25)",
            borderRadius: "3px",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
