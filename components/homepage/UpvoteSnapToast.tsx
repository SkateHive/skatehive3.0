"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const SNOOZE_KEY = "upvote_toast_snoozed_until";

function isSnoozeActive(): boolean {
  try {
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    if (!snoozedUntil) return false;
    const parsed = Number(snoozedUntil);
    if (isNaN(parsed)) return false;
    return Date.now() < parsed;
  } catch (_e) {
    return false;
  }
}

function snoozeToast(): void {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + TOAST_CONFIG.SNOOZE_DURATION)
    );
  } catch (_e) {
    // localStorage unavailable in SSR or strict private mode
  }
}

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
  // Tracks which permlink was locally confirmed as voted, preventing a delayed
  // blockchain refetch from resetting hasVoted to false before Hive propagates.
  const voteConfirmedPermlink = useRef<string | null>(null);

  const fetchSnapContainerData = useCallback(async () => {
    if (!canVote) {
      setIsSnapVoteLoading(false);
      return;
    }

    setIsSnapVoteLoading(true);

    try {
      const containerInfo = await getLastSnapsContainer();
      if (containerInfo) {
        // New container = clear local vote confirmation
        if (containerInfo.permlink !== voteConfirmedPermlink.current) {
          voteConfirmedPermlink.current = null;
        }

        const postDetails = await getPost(
          containerInfo.author,
          containerInfo.permlink
        );
        setSnapContainer(postDetails);
        if (effectiveUser && postDetails) {
          const onChainVote = postDetails.active_votes.some(
            (v) => v.voter === effectiveUser
          );
          // Preserve locally confirmed vote even if Hive hasn't propagated yet
          const locallyConfirmed =
            voteConfirmedPermlink.current === postDetails.permlink;
          setHasVoted(onChainVote || locallyConfirmed);
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
        // Set ref before state update so concurrent refetches don't race us
        voteConfirmedPermlink.current = snapContainer.permlink;
        setHasVoted(true);
        toast({
          title: t('upvoteToast.successTitle'),
          description: t('upvoteToast.successDescription'),
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error("Vote failed");
      }
    } catch (error: unknown) {
      console.error("Failed to upvote:", error);
      toast({
        title: t('upvoteToast.failedTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('upvoteToast.errorOccurred'),
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
      isSnapVoteLoading ||
      isSnoozeActive()
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
      render: ({ onClose }) => {
        const handleDismiss = () => {
          snoozeToast();
          onClose();
        };
        return (
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
            onClose={handleDismiss}
          />
        );
      },
    });

    // Auto-close after duration; snooze so the timer doesn't reopen immediately
    setTimeout(() => {
      if (toast.isActive(toastId)) {
        snoozeToast();
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
