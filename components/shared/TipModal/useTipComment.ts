"use client";

import { useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { useTranslations } from "@/contexts/LocaleContext";
import useHiveComment from "@/hooks/useHiveComment";

interface AnnounceArgs {
  discussion: Discussion;
  amount: string;
  token: string;
}

/**
 * Publishes the "tipped X" reply after a transfer settles.
 *
 * The transfer has already moved real money by the time this runs, so a failed
 * comment must never read as a failed tip: the caller shows the success toast
 * first and this only adds a separate warning if the reply does not land.
 */
export default function useTipComment() {
  const { comment } = useHiveComment();
  const t = useTranslations("tip");
  const toast = useToast();

  return useCallback(
    async ({ discussion, amount, token }: AnnounceArgs) => {
      // The template lives in the locale files so word order survives
      // translation; building the sentence by concatenation would not.
      const body = t("commentTemplate")
        .replace("{amount}", amount)
        .replace("{token}", token);

      try {
        await comment({
          parentAuthor: discussion.author,
          parentPermlink: discussion.permlink,
          body,
        });
        return true;
      } catch (error) {
        toast({
          title: t("commentFailedTitle"),
          description: t("commentFailedBody"),
          status: "warning",
          duration: 8000,
          isClosable: true,
        });
        return false;
      }
    },
    [comment, t, toast]
  );
}
