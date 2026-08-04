import React, { useRef, useState } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { formatTime } from "@/lib/utils/timeUtils";
import { useTranslations } from "@/contexts/LocaleContext";

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  onSeek: (time: number) => void;
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  currentTime,
  startTime,
  endTime,
  onSeek,
  onStartTimeChange,
  onEndTimeChange,
  onDragStart,
  onDragEnd,
}) => {
  const t = useTranslations();
  const trackRef = useRef<HTMLDivElement>(null);
  // Live position of the handle being dragged. Visual-only: committed to the
  // parent via onStart/EndTimeChange on mouseup, so parent re-renders don't
  // run on every mousemove and the drag stays smooth.
  const [dragPreview, setDragPreview] = useState<{ isStart: boolean; time: number } | null>(null);

  const visStart = dragPreview?.isStart ? dragPreview.time : startTime;
  const visEnd = dragPreview && !dragPreview.isStart ? dragPreview.time : endTime;
  const selectedDuration = visEnd - visStart;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timePosition = (clickX / rect.width) * duration;
    onSeek(timePosition);
  };

  const createDragHandler = (
    isStartHandle: boolean,
    onChange: (time: number) => void
  ) => {
    return (
      e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();
      onDragStart();

      const track = trackRef.current;
      if (!track) return;

      // Latest drag position; applied visually via rAF, committed on release.
      let latestTime = isStartHandle ? startTime : endTime;
      let rafId: number | null = null;

      const getEventX = (event: MouseEvent | TouchEvent): number => {
        if ("touches" in event) {
          return (
            event.touches[0]?.clientX || event.changedTouches[0]?.clientX || 0
          );
        }
        return event.clientX;
      };

      const applyPreview = () => {
        rafId = null;
        setDragPreview({ isStart: isStartHandle, time: latestTime });
      };

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        // Prevent default behavior for touch events to avoid scrolling
        if ("touches" in moveEvent) {
          moveEvent.preventDefault();
        }

        const rect = track.getBoundingClientRect();
        const newX = getEventX(moveEvent) - rect.left;
        let newTime = (newX / rect.width) * duration;

        // Clamp the values
        if (isStartHandle) {
          newTime = Math.max(0, Math.min(newTime, endTime - 0.5));
        } else {
          newTime = Math.min(duration, Math.max(newTime, startTime + 0.5));
        }

        latestTime = newTime;
        // Throttle visual updates to one per frame
        if (rafId === null) rafId = requestAnimationFrame(applyPreview);
      };

      const handleEnd = () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
        if (rafId !== null) cancelAnimationFrame(rafId);
        setDragPreview(null);
        onChange(latestTime); // single committed update
        onDragEnd();
      };

      // Add both mouse and touch event listeners
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleEnd, { passive: false });
    };
  };

  // Keyboard slider behavior: arrows nudge by 1s, Home/End jump to the
  // handle's min/max, clamped to keep the 0.5s minimum selection.
  const createKeyHandler = (
    isStartHandle: boolean,
    onChange: (time: number) => void
  ) => {
    return (e: React.KeyboardEvent<HTMLDivElement>) => {
      const current = isStartHandle ? startTime : endTime;
      const min = isStartHandle ? 0 : startTime + 0.5;
      const max = isStartHandle ? endTime - 0.5 : duration;
      let next: number;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = current - 1;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = current + 1;
          break;
        case "Home":
          next = min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }
      e.preventDefault();
      onChange(Math.max(min, Math.min(max, next)));
    };
  };

  return (
    <Box width="100%" display="flex" flexDirection="column" alignItems="center">
      {/* Timeline Trimmer */}
      <Box width="100%" px={2}>
        <Text fontSize="xs" mb={3} textAlign="center" color="dim">
          {t("compose.trimDragHandles")}
        </Text>
        {/* Timeline Track */}
        <Box
          ref={trackRef}
          width="100%"
          height="50px"
          bg="background"
          position="relative"
          cursor="pointer"
          border="1px solid"
          borderColor="border"
          onClick={handleTimelineClick}
        >
          {/* Current Time Indicator */}
          <Box
            position="absolute"
            left={`${(currentTime / duration) * 100}%`}
            top="0"
            bottom="0"
            width="3px"
            bg="accent"
            zIndex={4}
            transition="left 0.1s ease"
          />

          {/* Selected Region */}
          <Box
            position="absolute"
            left={`${(visStart / duration) * 100}%`}
            width={`${((visEnd - visStart) / duration) * 100}%`}
            height="100%"
            bg="primary"
            opacity={0.8}
            zIndex={1}
          />

          {/* Start Handle */}
          <Box
            position="absolute"
            left={`${(visStart / duration) * 100}%`}
            top="50%"
            transform="translate(-50%, -50%)"
            width="24px"
            height="40px"
            bg="muted"
            border="3px solid"
            borderColor="primary"
            cursor="ew-resize"
            zIndex={5}
            boxShadow="0 3px 6px rgba(0,0,0,0.4)"
            _hover={{ transform: "translate(-50%, -50%) scale(1.1)" }}
            _active={{ opacity: 0.85 }}
            // Only animate hover scale/opacity — transitioning `left` would lag the drag
            transition="transform 0.1s ease, opacity 0.1s ease"
            role="slider"
            tabIndex={0}
            aria-label={t("compose.trimStartHandle")}
            aria-valuemin={0}
            aria-valuemax={Math.round((endTime - 0.5) * 10) / 10}
            aria-valuenow={Math.round(visStart * 10) / 10}
            aria-valuetext={formatTime(visStart)}
            _focusVisible={{ outline: "2px solid", outlineColor: "accent" }}
            onKeyDown={createKeyHandler(true, onStartTimeChange)}
            onMouseDown={createDragHandler(true, onStartTimeChange)}
            onTouchStart={createDragHandler(true, onStartTimeChange)}
            // A click on the handle must not bubble to the track's seek handler
            onClick={(e) => e.stopPropagation()}
            // Touch-friendly styles
            style={{
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            {/* Handle Visual Indicator */}
            <Flex align="center" justify="center" height="100%">
              <Flex direction="column" gap="2px">
                <Box width="2px" height="6px" bg="primary" />
                <Box width="2px" height="6px" bg="primary" />
                <Box width="2px" height="6px" bg="primary" />
              </Flex>
            </Flex>
          </Box>

          {/* End Handle */}
          <Box
            position="absolute"
            left={`${(visEnd / duration) * 100}%`}
            top="50%"
            transform="translate(-50%, -50%)"
            width="24px"
            height="40px"
            bg="muted"
            border="3px solid"
            borderColor="primary"
            cursor="ew-resize"
            zIndex={5}
            boxShadow="0 3px 6px rgba(0,0,0,0.4)"
            _hover={{ transform: "translate(-50%, -50%) scale(1.1)" }}
            _active={{ opacity: 0.85 }}
            // Only animate hover scale/opacity — transitioning `left` would lag the drag
            transition="transform 0.1s ease, opacity 0.1s ease"
            role="slider"
            tabIndex={0}
            aria-label={t("compose.trimEndHandle")}
            aria-valuemin={Math.round((startTime + 0.5) * 10) / 10}
            aria-valuemax={Math.round(duration * 10) / 10}
            aria-valuenow={Math.round(visEnd * 10) / 10}
            aria-valuetext={formatTime(visEnd)}
            _focusVisible={{ outline: "2px solid", outlineColor: "accent" }}
            onKeyDown={createKeyHandler(false, onEndTimeChange)}
            onMouseDown={createDragHandler(false, onEndTimeChange)}
            onTouchStart={createDragHandler(false, onEndTimeChange)}
            // A click on the handle must not bubble to the track's seek handler
            onClick={(e) => e.stopPropagation()}
            // Touch-friendly styles
            style={{
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            {/* Handle Visual Indicator */}
            <Flex align="center" justify="center" height="100%">
              <Flex direction="column" gap="2px">
                <Box width="2px" height="6px" bg="primary" />
                <Box width="2px" height="6px" bg="primary" />
                <Box width="2px" height="6px" bg="primary" />
              </Flex>
            </Flex>
          </Box>
        </Box>
        {/* Time Labels */}
        <Flex justify="space-between" width="100%" fontSize="xs" mt={2}>
          <Text color="text">{formatTime(visStart)}</Text>
          <Text color="primary">{formatTime(selectedDuration)}</Text>
          <Text color="text">{formatTime(duration)}</Text>
        </Flex>
      </Box>
    </Box>
  );
};

export default VideoTimeline;
