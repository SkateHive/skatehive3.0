"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  Text,
  Icon,
  VStack,
  Image,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { FaImage } from "react-icons/fa";
import { useTranslations } from "@/lib/i18n/hooks";
import VideoPreview from "./VideoPreview";
import SnapModal from "./SnapModal";
import { useHeicFallback } from "@/hooks/useHeicFallback";

interface SoftSnapsGridProps {
  snaps: Discussion[];
}

// Extract media URLs from snap body content (same logic as useUserSnaps)
function extractMediaFromSnap(snap: Discussion) {
  try {
    const body = snap.body || "";
    const allImages: string[] = [];
    const allVideos: string[] = [];

    // 1. Extract URLs from markdown image syntax ![alt](url) → Images
    const markdownImagePattern = /!\[.*?\]\(([^\)]+)\)/gi;
    let match;
    while ((match = markdownImagePattern.exec(body)) !== null) {
      allImages.push(match[1]);
    }

    // 2. Extract src from iframes → Videos
    const iframeSrcPattern = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = iframeSrcPattern.exec(body)) !== null) {
      allVideos.push(match[1]);
    }

    // 3. Extract media from json_metadata.image
    try {
      const metadata = JSON.parse(snap.json_metadata || "{}");
      const mdImages = Array.isArray(metadata.image)
        ? metadata.image
        : typeof metadata.image === "string"
          ? [metadata.image]
          : [];
      allImages.push(...mdImages);
    } catch {}

    // 4. Extract direct media URLs in body (avoid markdown duplicates and trailing punctuation)
    const cleanedBody = body
      // remove markdown image/link patterns so we don't double-capture
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[[^\]]*\]\([^)]*\)/g, "");
    const directMediaPattern =
      /(https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|mp4|mov|m4v|m3u8))(?=$|\s|[)"'])/gi;
    while ((match = directMediaPattern.exec(cleanedBody)) !== null) {
      const url = match[1];
      if (/\.(mp4|mov|m4v|m3u8)$/i.test(url)) {
        allVideos.push(url);
      } else {
        allImages.push(url);
      }
    }

    // Deduplicate and ensure proper URLs
    const uniqueImages = [...new Set(allImages)].map((url) =>
      url.startsWith("http") ? url : `https://${url}`
    );
    const uniqueVideos = [...new Set(allVideos)].map((url) =>
      url.startsWith("http") ? url : `https://${url}`
    );

    return {
      images: uniqueImages,
      videos: uniqueVideos,
      hasMedia: uniqueImages.length > 0 || uniqueVideos.length > 0,
    };
  } catch {
    return { images: [], videos: [], hasMedia: false };
  }
}

type SnapWithMedia = Discussion & {
  media: {
    images: string[];
    videos: string[];
    hasMedia: boolean;
  };
};

const SoftSnapGridItem = React.memo(
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

SoftSnapGridItem.displayName = "SoftSnapGridItem";

export default function SoftSnapsGrid({ snaps }: SoftSnapsGridProps) {
  const t = useTranslations("common");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedSnapIndex, setSelectedSnapIndex] = useState<number>(0);

  // Process snaps to add media info
  const snapsWithMedia = useMemo(() => {
    return snaps
      .map((snap) => ({
        ...snap,
        media: extractMediaFromSnap(snap),
      }))
      .filter((snap) => snap.media.hasMedia) as SnapWithMedia[];
  }, [snaps]);

  const handleSnapClick = useCallback(
    (snapIndex: number) => {
      setSelectedSnapIndex(snapIndex);
      onOpen();
    },
    [onOpen]
  );

  const handleSnapChange = useCallback((newSnapIndex: number) => {
    setSelectedSnapIndex(newSnapIndex);
  }, []);

  const handleModalClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!snaps || snaps.length === 0) {
    return (
      <VStack spacing={4} py={8}>
        <Icon as={FaImage} boxSize={12} color="muted" />
        <Text color="muted" textAlign="center">
          {t("noSnaps")}
        </Text>
      </VStack>
    );
  }

  if (snapsWithMedia.length === 0) {
    return (
      <VStack spacing={4} py={8}>
        <Icon as={FaImage} boxSize={12} color="muted" />
        <Text color="muted" textAlign="center">
          No snaps with media found
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
        {snapsWithMedia.map((snap, index) => (
          <Box
            key={`${snap.author}-${snap.permlink}`}
            mb="0px"
            sx={{ breakInside: "avoid" }}
          >
            <SoftSnapGridItem
              snap={snap}
              onClick={() => handleSnapClick(index)}
            />
          </Box>
        ))}
      </Box>

      {isOpen &&
        snapsWithMedia.length > 0 &&
        selectedSnapIndex >= 0 &&
        selectedSnapIndex < snapsWithMedia.length && (
          <SnapModal
            snap={snapsWithMedia[selectedSnapIndex]}
            snaps={snapsWithMedia}
            currentSnapIndex={selectedSnapIndex}
            isOpen={isOpen}
            onClose={handleModalClose}
            onSnapChange={handleSnapChange}
          />
        )}
    </>
  );
}
