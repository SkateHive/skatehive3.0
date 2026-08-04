"use client";

/**
 * ⚠️ SUNSET / DEPRECATED — NOT IN USE (kept intentionally, do not delete yet).
 *
 * This recurring toast nudged users to upvote the latest `peak.snaps` snap
 * container. We've stopped rendering it (see CommunityToasts.tsx) in favor of
 * profile-setup CTA toasts that prompt the user with actions relevant to their
 * own account (complete profile, add avatar, increase HP, etc.).
 *
 * Left in the tree on purpose as a reference implementation for the recurring
 * toast pattern (usePeriodicTimer + ToastCard + lastShownTime throttle) and in
 * case we want to bring it back. If it's still unused after the new CTA toast
 * system ships and settles, it can be removed.
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { FaHeart } from "react-icons/fa";
import useHiveVote from "@/hooks/useHiveVote";
import { getLastSnapsContainer, getPost } from "@/lib/hive/client-functions";
import { Discussion } from "@hiveio/dhive";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePeriodicTimer } from "@/hooks/usePeriodicTimer";
import { TOAST_CONFIG } from "@/config/toast.config";
import ToastCard from "@/components/shared/ToastCard";
import { useTranslations } from "@/contexts/LocaleContext";

interface UpvoteSnapToastProps {
  showInterval?: number;
  displayDuration?: number;
}

export default function UpvoteSnapToast({
  showInterval = TOAST_CONFIG.SHOW_INTERVAL,
  displayDuration = TOAST_CONFIG.DISPLAY_DURATION,
}: UpvoteSnapToastProps) {
  const t = useTranslations();
  const { vote, effectiveUser, canVote } = useHiveVote();
  const [snapContainer, setSnapContainer] = useState<Discussion | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isSnapVoteLoading, setIsSnapVoteLoading] = useState(true);
  const [lastShownTime, setLastShownTime] = useState<number>(0);
  const toast = useToast();
  const { isDesktop, isMounted } = useIsDesktop();

  const fetchSnapContainerData = useCallback(async () => {
    if (!canVote) {
      setIsSnapVoteLoading(false);
      return;
    }

    setIsSnapVoteLoading(true);

    try {
      const containerInfo = await getLastSnapsContainer();
      if (containerInfo) {
        const postDetails = await getPost(
          containerInfo.author,
          containerInfo.permlink
        );
        setSnapContainer(postDetails);
        if (effectiveUser && postDetails) {
          const userVote = postDetails.active_votes.some(
            (v) => v.voter?.toLowerCase() === effectiveUser?.toLowerCase()
          );
          setHasVoted(userVote);
        } else {
          setHasVoted(false);
        }
      }
    } catch (error) {
      console.error("Failed to get snap container", error);
      setHasVoted(false);
    } finally {
      setIsSnapVoteLoading(false);
    }
  }, [effectiveUser, canVote]);

  const handleUpvote = useCallback(async () => {
    if (!canVote || !snapContainer) return;

    try {
      const response = await vote(
        snapContainer.author,
        snapContainer.permlink,
        TOAST_CONFIG.VOTE_WEIGHT
      );

      if (response.success) {
        toast({
          title: t('upvoteToast.successTitle'),
          description: t('upvoteToast.successDescription'),
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        setHasVoted(true);
      } else {
        throw new Error("Vote failed");
      }
    } catch (error: any) {
      console.error("Failed to upvote:", error);
      toast({
        title: t('upvoteToast.failedTitle'),
        description:
          error.message || t('upvoteToast.errorOccurred'),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [vote, snapContainer, toast, t, canVote]);

  const showUpvoteToast = useCallback(() => {
    if (
      !isMounted ||
      !isDesktop ||
      !canVote ||
      !snapContainer ||
      hasVoted ||
      isSnapVoteLoading
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastShownTime < showInterval) {
      return;
    }

    setLastShownTime(now);

    const toastId = toast({
      title: t('upvoteToast.supportCommunity'),
      description: t('upvoteToast.helpSkateHive'),
      status: "info",
      duration: displayDuration,
      isClosable: true,
      position: "bottom-right",
      render: ({ onClose }) => (
        <ToastCard
          title={t('upvoteToast.supportCommunity')}
          description={t('upvoteToast.helpSkateHiveDetailed')}
          detail={`${t('upvoteToast.container')}: ${snapContainer.author}/${snapContainer.permlink}`}
          icon={<FaHeart size={16} />}
          primaryButton={{
            label: t('upvoteToast.upvoteNow'),
            icon: <FaHeart size={12} />,
            onClick: async () => {
              await handleUpvote();
              onClose();
            },
            colorScheme: "blue",
          }}
          onClose={onClose}
        />
      ),
    });

    // Auto-close after duration if user hasn't interacted
    setTimeout(() => {
      if (toast.isActive(toastId)) {
        toast.close(toastId);
      }
    }, displayDuration);
  }, [
    isMounted,
    isDesktop,
    canVote,
    snapContainer,
    hasVoted,
    lastShownTime,
    showInterval,
    displayDuration,
    toast,
    handleUpvote,
    isSnapVoteLoading,
    t,
  ]);

  // Load snap container data when user changes
  useEffect(() => {
    if (canVote && isMounted) {
      fetchSnapContainerData();
    }
  }, [canVote, isMounted, fetchSnapContainerData]);

  // Refresh data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && canVote && isMounted) {
        fetchSnapContainerData();
      }
    };

    if (isMounted) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    }
  }, [canVote, isMounted, fetchSnapContainerData]);

  // Set up periodic timer for showing toasts
  usePeriodicTimer(showUpvoteToast, {
    initialDelay: TOAST_CONFIG.INITIAL_DELAY,
    interval: showInterval,
    enabled: isMounted && isDesktop && canVote,
  });

  return null;
}
