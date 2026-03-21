"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Image,
  Text,
  Icon,
  Spinner,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { FaImage } from "react-icons/fa";
import useUserSnaps from "@/hooks/useUserSnaps";
import { useProfileDebug } from "@/lib/utils/profileDebug";
import VideoPreview from "./VideoPreview";
import SnapModal, { type SnapWithMedia } from "./SnapModal";
import { preloadThumbnails } from "@/hooks/useVideoThumbnail";
import { useHeicFallback } from "@/hooks/useHeicFallback";

interface SnapsGridProps {
  username: string;
}

const SnapGridItem = React.memo(
  ({ snap, onClick }: { snap: SnapWithMedia; onClick: () => void }) => {
    const firstImage = snap.media.images[0];
    const firstVideo = snap.media.videos[0];
    const hasMultipleMedia =
      snap.media.images.length + snap.media.videos.length > 1;
    const { src: imageSrc, onError: onImageError } = useHeicFallback(firstImage || "");

    return (
      <Box
        position="relative"
        cursor="pointer"
        onClick={onClick}
        _hover={{
          transform: "scale(1.02)",
          transition: "transform 0.2s",
        }}
        overflow="hidden"
        bg="muted"
        width="100%"
      >
        {firstImage ? (
          <Image
            src={imageSrc}
            alt="Snap content"
            objectFit="cover"
            width="100%"
            height="auto"
            loading="lazy"
            onError={onImageError}
          />
        ) : firstVideo ? (
          <Box width="100%" overflow="hidden">
            <VideoPreview src={firstVideo} onClick={onClick} />
          </Box>
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="200px"
            bg="muted"
          >
            <Icon as={FaImage} boxSize={8} color="text" />
          </Box>
        )}

        {/* Multiple media indicator */}
        {hasMultipleMedia && (
          <Box
            position="absolute"
            top={2}
            right={2}
            bg="blackAlpha.700"
            borderRadius="full"
            p={1}
          >
            <Icon as={FaImage} color="white" boxSize={3} />
          </Box>
        )}
      </Box>
    );
  }
);

SnapGridItem.displayName = "SnapGridItem";

export default function SnapsGrid({ username }: SnapsGridProps) {
  useProfileDebug("SnapsGrid");
  const { snaps, isLoading, hasMore, loadMoreSnaps } = useUserSnaps(username);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedSnapIndex, setSelectedSnapIndex] = useState<number>(0);
  const [hasCheckedUrl, setHasCheckedUrl] = useState<boolean>(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Preload thumbnails for video snaps to improve perceived performance
  useEffect(() => {
    if (snaps.length > 0) {
      const videoUrls = snaps
        .filter((snap) => snap.media.videos.length > 0)
        .slice(0, 6) // Only preload first 6 videos
        .map((snap) => snap.media.videos[0]);

      if (videoUrls.length > 0) {
        preloadThumbnails(videoUrls).catch((error) => {
          // Preload errors handled silently for production
        });
      }
    }
  }, [snaps]);

  // Memoize URL parsing to avoid repeated calculations
  const urlPermlink = useMemo(() => {
    if (typeof window === "undefined") return null; // SSR safety

    // First check URL search params (for redirected URLs like ?view=snaps&snap=permlink)
    const searchParams = new URLSearchParams(window.location.search);
    const snapParam = searchParams.get("snap");
    if (snapParam) {
      return snapParam;
    }

    // Then check path-based URLs (/user/username/snap/permlink)
    const pathParts = window.location.pathname.split("/");
    const snapIndex = pathParts.indexOf("snap");
    return snapIndex !== -1 && pathParts.length >= snapIndex + 2
      ? pathParts[snapIndex + 1]
      : null;
  }, []);

  // Check for snap parameter in URL on component mount and when snaps load
  // Only run this when modal is closed to prevent reopening during navigation
  useEffect(() => {
    // Only open modal if it's not already open and we have a URL permlink and haven't checked yet
    if (
      urlPermlink &&
      snaps.length > 0 &&
      !isLoading &&
      !isOpen &&
      !hasCheckedUrl
    ) {
      // Find the snap index by permlink (author is inferred from username context)
      const foundSnapIndex = snaps.findIndex(
        (snap) => snap.permlink === urlPermlink
      );
      if (foundSnapIndex !== -1) {
        setSelectedSnapIndex(foundSnapIndex);
        setHasCheckedUrl(true);
        // Small delay to ensure state is set before opening modal
        setTimeout(() => onOpen(), 50);
      } else {
        setHasCheckedUrl(true); // Mark as checked even if not found
      }
    }
  }, [snaps, isLoading, onOpen, urlPermlink, isOpen, hasCheckedUrl]);

  const handleSnapClick = useCallback(
    (snapIndex: number) => {
      const snap = snaps[snapIndex];
      setSelectedSnapIndex(snapIndex);

      // Create clean URL: /user/snap-author/snap/permlink
      // Use the snap's actual author for the URL to ensure correct context
      const cleanUrl = `/user/${snap.author}/snap/${snap.permlink}`;
      window.history.pushState({}, "", cleanUrl);

      onOpen();
    },
    [snaps, onOpen]
  );

  const handleSnapChange = useCallback(
    (newSnapIndex: number) => {
      const snap = snaps[newSnapIndex];
      setSelectedSnapIndex(newSnapIndex);

      // Update URL with clean format using snap's author
      const cleanUrl = `/user/${snap.author}/snap/${snap.permlink}`;
      window.history.pushState({}, "", cleanUrl);
    },
    [snaps]
  );

  const handleModalClose = useCallback(() => {
    // Close the modal first
    onClose();

    // Then update the URL
    const searchParams = new URLSearchParams(window.location.search);
    const hasSnapParam = searchParams.has("snap");

    if (hasSnapParam) {
      // Remove snap parameter and update URL
      searchParams.delete("snap");
      const baseUrl = `/user/${username}?${searchParams.toString()}`;
      window.history.pushState({}, "", baseUrl);
    } else {
      // Return to clean profile URL with snaps view
      // Use the original username from props for consistency
      const baseUrl = `/user/${username}?view=snaps`;
      window.history.pushState({}, "", baseUrl);
    }
  }, [username, onClose]);

  // Optimized infinite scroll with better debouncing and throttling
  useEffect(() => {
    if (!hasMore || isLoading) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollPosition =
            window.innerHeight + document.documentElement.scrollTop;
          const documentHeight = document.documentElement.offsetHeight;

          if (scrollPosition >= documentHeight - 500) {
            // Increased threshold for better UX
            if (hasMore && !isLoading) {
              loadMoreSnaps();
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [hasMore, isLoading, loadMoreSnaps]);

  // IntersectionObserver-based trigger to load more when sentinel enters view
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore && !isLoading) {
            loadMoreSnaps();
          }
        });
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMoreSnaps]);

  if (snaps.length === 0 && !isLoading) {
    return (
      <VStack spacing={4} py={8}>
        <Icon as={FaImage} boxSize={12} color="muted" />
        <Text color="muted" textAlign="center">
          No snaps with media found for @{username}
        </Text>
      </VStack>
    );
  }

  return (
    <>
      <Box
        w="full"
        sx={{
          columnCount: { base: 2, md: 3, lg: 4 },
          columnGap: "0px",
        }}
      >
        {snaps.map((snap, index) => (
          <Box
            key={`${snap.author}-${snap.permlink}`} // More specific key
            mb="0px"
            sx={{ breakInside: "avoid" }}
          >
            <SnapGridItem snap={snap} onClick={() => handleSnapClick(index)} />
          </Box>
        ))}
      </Box>

      <Box ref={sentinelRef} w="full" h="1px" />

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <Spinner color="primary" />
        </Box>
      )}

      {isOpen &&
        snaps.length > 0 &&
        selectedSnapIndex >= 0 &&
        selectedSnapIndex < snaps.length && (
          <SnapModal
            snap={snaps[selectedSnapIndex]}
            snaps={snaps}
            currentSnapIndex={selectedSnapIndex}
            isOpen={isOpen}
            onClose={handleModalClose}
            onSnapChange={handleSnapChange}
          />
        )}
    </>
  );
}
