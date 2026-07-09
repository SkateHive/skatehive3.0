"use client";
import React, { useMemo, useEffect, useState } from "react";
import {
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import Magazine from "./Magazine";
import { Discussion } from "@hiveio/dhive";
import { useCuratedMagazine } from "@/hooks/useCuratedMagazine";

interface MagazineModalProps {
  isOpen: boolean;
  onClose: () => void;
  // For username-based magazine (profile view) - can provide posts directly
  hiveUsername?: string;
  posts?: Discussion[];
  isLoading?: boolean;
  // Keep the given posts' selection + order verbatim (editorial edition).
  preserveOrder?: boolean;
  // For tag-based magazine (blog view)
  magazineTag?: { tag: string; limit: number }[];
  magazineQuery?: string;
  // Custom magazine cover for user profiles
  zineCover?: string;
  // User profile data
  userProfileImage?: string;
  displayName?: string;
  userLocation?: string;
}

/**
 * Unified MagazineModal component that can be used for both profile and blog magazine views.
 *
 * Usage:
 * - For profile magazine: <MagazineModal username="skater123" posts={posts} isLoading={isLoading} />
 *   (Uses pre-fetched user posts from useProfilePosts hook)
 * - For blog magazine: <MagazineModal magazineTag={[{tag: "skatehive", limit: 20}]} magazineQuery="trending" />
 *   (Fetches trending posts from the community, Bridge API max limit is 20)
 */
const MagazineModal = React.memo(function MagazineModal({
  isOpen,
  onClose,
  hiveUsername,
  posts,
  isLoading,
  preserveOrder,
  magazineTag,
  magazineQuery = "created",
  zineCover,
  userProfileImage,
  displayName,
  userLocation,
}: MagazineModalProps) {
  const [currentQuery, setCurrentQuery] = React.useState(magazineQuery);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsMounted(false);
      return;
    }
    let raf: number;
    const id = setTimeout(() => {
      raf = requestAnimationFrame(() => setIsMounted(true));
    }, 100);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  // Memoize the tag calculation to prevent unnecessary re-renders
  const tag = useMemo(() => {
    return hiveUsername
      ? [{ tag: hiveUsername, limit: 20 }]
      : magazineTag || []; // Bridge API max limit is 20
  }, [hiveUsername, magazineTag]);

  // Community/blog magazine (no explicit posts, no profile user): show the
  // curated edition the ops portal published, falling back to the live feed.
  const isCommunity = posts === undefined && !hiveUsername;
  const { curated, loaded } = useCuratedMagazine(isCommunity);

  // If posts are provided (profile view), use them directly.
  // Community view → curated edition (or fallback). Otherwise tag/query.
  const magazineProps = useMemo(() => {
    if (posts !== undefined) {
      // Don't pass tag/query when providing posts directly
      return {
        posts,
        isLoading,
        preserveOrder,
        error: null,
        zineCover,
        hiveUsername,
        userProfileImage,
        displayName,
        userLocation,
      };
    }
    if (isCommunity) {
      if (!loaded) return { posts: [], isLoading: true };
      if (curated && curated.length > 0) return { posts: curated, preserveOrder: true };
      // no published edition → fall back to the live community feed below
    }
    return {
      tag,
      query: currentQuery,
    };
  }, [
    posts,
    isLoading,
    preserveOrder,
    tag,
    currentQuery,
    zineCover,
    hiveUsername,
    userProfileImage,
    displayName,
    userLocation,
    isCommunity,
    curated,
    loaded,
  ]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      motionPreset="none"
      blockScrollOnMount={false}
      closeOnOverlayClick={true}
    >
      <ModalOverlay bg="blackAlpha.800" />
      <ModalContent bg="background" m={0} borderRadius={0}>
        <ModalCloseButton
          zIndex={10}
          color="text"
          _hover={{ bg: "red.500", color: "white" }}
        />
        <ModalBody p={0} m={0} w="100%" h="100vh" overflow="hidden">
          <Box
            p={0}
            m={0}
            w="100%"
            h="100%"
            overflow="hidden"
            position="relative"
          >
            {isMounted && <Magazine {...magazineProps} />}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});

export default MagazineModal;
