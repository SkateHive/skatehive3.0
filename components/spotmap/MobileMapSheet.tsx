"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";

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
  /**
   * Optional label rendered in the drag area so the user knows what's
   * inside the sheet without expanding it (e.g. "Spots in this view · 52").
   * The whole header row is draggable, so a bigger label = bigger touch
   * target.
   */
  label?: React.ReactNode;
}

const DEFAULT_DETENTS: Record<Detent, number> = {
  peek: 22,
  mid: 55,
  full: 88,
};

const DETENT_ORDER: Detent[] = ["peek", "mid", "full"];

/**
 * Airbnb-style draggable bottom sheet for the mobile /map view.
 *
 * Drag semantics
 *   - The header row (drag handle + optional label) is always draggable.
 *   - The content area drags the sheet up until the sheet hits "full";
 *     only then does it switch to native vertical scrolling. We achieve
 *     this by toggling `touch-action` on the scroller per detent so the
 *     browser does the right thing on iOS without preventDefault tricks
 *     (which Safari ignores on passive listeners anyway).
 *   - At "full" + scrollTop===0, a downward pull collapses one detent.
 *   - Tapping the header (no significant drag) cycles peek → mid → full
 *     → peek so the sheet is usable for people who can't get the drag
 *     gesture right.
 */
export default function MobileMapSheet({
  children,
  initialDetent = "peek",
  detents = DEFAULT_DETENTS,
  onDetentChange,
  label,
}: MobileMapSheetProps) {
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const [dragHeightVh, setDragHeightVh] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    y: number;
    heightVh: number;
    vh: number;
    movedPx: number;
    startedAt: number;
  } | null>(null);

  const visibleVh = dragHeightVh ?? detents[detent];
  // The scroller is only "scrollable" when the sheet is truly at the full
  // detent (not mid-drag). Anywhere short of that, drags should expand
  // the sheet, not move the scrollTop.
  const isExpanded = detent === "full" && dragHeightVh === null;

  const setDetentAndNotify = useCallback(
    (next: Detent) => {
      setDetent(next);
      setDragHeightVh(null);
      onDetentChange?.(next);
    },
    [onDetentChange]
  );

  const snapTo = useCallback(
    (vh: number) => {
      // Pick the detent whose vh is closest to where the user released.
      const entries = (Object.entries(detents) as [Detent, number][]).sort(
        (a, b) => Math.abs(a[1] - vh) - Math.abs(b[1] - vh)
      );
      setDetentAndNotify(entries[0][0]);
    },
    [detents, setDetentAndNotify]
  );

  // -------- Drag lifecycle (shared by handle and content) --------

  const beginDrag = useCallback(
    (clientY: number) => {
      const vh = window.innerHeight;
      dragStartRef.current = {
        y: clientY,
        heightVh: visibleVh,
        vh,
        movedPx: 0,
        startedAt: Date.now(),
      };
    },
    [visibleVh]
  );

  const onMove = useCallback(
    (clientY: number) => {
      const start = dragStartRef.current;
      if (!start) return;
      const deltaPx = start.y - clientY; // upward = positive
      start.movedPx = Math.max(start.movedPx, Math.abs(deltaPx));
      const deltaVh = (deltaPx / start.vh) * 100;
      const next = Math.max(
        detents.peek,
        Math.min(detents.full, start.heightVh + deltaVh)
      );
      setDragHeightVh(next);
    },
    [detents.full, detents.peek]
  );

  const endDrag = useCallback(() => {
    const start = dragStartRef.current;
    if (!start) return;
    const wasTap =
      start.movedPx < 8 && Date.now() - start.startedAt < 250;
    const finalVh = dragHeightVh ?? detents[detent];
    dragStartRef.current = null;
    if (wasTap) {
      // Cycle to the next detent (peek → mid → full → peek)
      const idx = DETENT_ORDER.indexOf(detent);
      const next = DETENT_ORDER[(idx + 1) % DETENT_ORDER.length];
      setDragHeightVh(null);
      setDetentAndNotify(next);
      return;
    }
    snapTo(finalVh);
  }, [dragHeightVh, detent, detents, snapTo, setDetentAndNotify]);

  // -------- Handle handlers (always draggable) --------

  const onHandleTouchStart = (e: React.TouchEvent) => beginDrag(e.touches[0].clientY);
  const onHandleTouchMove = (e: React.TouchEvent) => onMove(e.touches[0].clientY);
  const onHandleTouchEnd = endDrag;

  // -------- Content handlers (drag-the-sheet OR scroll-content) --------

  const contentTouchStart = (e: React.TouchEvent) => {
    if (isExpanded) {
      // Sheet is fully open. Let native scroll happen unless we detect a
      // pull-down from the top, which is handled in touchmove.
      const scroller = scrollerRef.current;
      if (scroller && scroller.scrollTop > 0) {
        dragStartRef.current = null;
        return;
      }
    }
    beginDrag(e.touches[0].clientY);
  };

  const contentTouchMove = (e: React.TouchEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const dy = start.y - e.touches[0].clientY;
    if (isExpanded) {
      // Only allow drag if the scroller is at top AND the user is pulling
      // *down* (collapsing). Anything else is a scroll.
      const scroller = scrollerRef.current;
      if (scroller && scroller.scrollTop === 0 && dy < 0) {
        onMove(e.touches[0].clientY);
      } else {
        dragStartRef.current = null;
      }
    } else {
      onMove(e.touches[0].clientY);
    }
  };

  const contentTouchEnd = endDrag;

  // -------- Mouse drag (desktop dev convenience) --------
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
      bg="rgba(10,10,10,0.97)"
      borderTop="1px solid"
      borderColor="primary"
      borderTopRadius="20px"
      boxShadow="0 -12px 32px rgba(0,0,0,0.55)"
      style={{
        transition: dragStartRef.current ? "none" : "height 0.22s ease",
        backdropFilter: "blur(10px)",
        // The sheet itself never moves natively — children opt in to
        // scrolling via their own `touch-action` when appropriate.
        touchAction: "none",
      }}
      display="flex"
      flexDirection="column"
    >
      {/* Drag handle + optional label (a single tall touch target). */}
      <Box
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onMouseDown={(e) => beginDrag(e.clientY)}
        cursor={dragStartRef.current ? "grabbing" : "grab"}
        flexShrink={0}
        py={3}
        px={4}
        // A subtle hairline at the bottom separates handle from content,
        // giving the user a visual cue for where to grab.
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        userSelect="none"
        style={{ touchAction: "none" }}
        aria-label="Drag to expand or collapse the spot list"
        role="button"
      >
        <Box
          mx="auto"
          w="44px"
          h="5px"
          borderRadius="full"
          bg="rgba(167,255,0,0.6)"
          mb={label ? 2 : 0}
        />
        {label && (
          <HStack justify="center" spacing={2}>
            <Text fontSize="xs" color="gray.300" fontWeight="700" letterSpacing="wide">
              {label}
            </Text>
          </HStack>
        )}
      </Box>

      {/* Scrollable content — only scrolls natively when the sheet is at
          the full detent; otherwise drags move the sheet. */}
      <Box
        ref={scrollerRef}
        flex="1"
        overflowY={isExpanded ? "auto" : "hidden"}
        onTouchStart={contentTouchStart}
        onTouchMove={contentTouchMove}
        onTouchEnd={contentTouchEnd}
        style={{ touchAction: isExpanded ? "pan-y" : "none" }}
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
