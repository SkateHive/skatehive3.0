"use client";

/**
 * Renders one app-owned notification (migration 0030) — the things SkateHive
 * itself decided, as opposed to the Hive chain events NotificationItem shows.
 *
 * Visually it borrows NotificationItem's card (bg="muted", accent bar on the
 * left when unread) so the two lists read as one inbox, but it deliberately
 * uses an icon instead of a Hive avatar: nobody "sent" these.
 */

import { Box, HStack, Icon, Link, Text, VStack } from "@chakra-ui/react";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaBell } from "react-icons/fa";
import type { AppNotification } from "@/contexts/NotificationContext";
import { useTranslations } from "@/lib/i18n/hooks";
import { formatNotificationDate } from "./utils";

const TYPE_STYLE: Record<
  string,
  { icon: typeof FaBell; color: string }
> = {
  crosspost_approved: { icon: FaCheckCircle, color: "green.400" },
  crosspost_rejected: { icon: FaTimesCircle, color: "orange.400" },
  crosspost_failed: { icon: FaExclamationTriangle, color: "red.400" },
};

type Translate = (key: string) => string;

/**
 * The stored title/body are written server-side, in English, at the moment the
 * curator decides — so they can't follow the reader's language. The row also
 * stores `type` and `metadata`, which is everything needed to rebuild the copy
 * here instead. Falls back to the stored text for unknown types (or a locale
 * missing the key), so nothing ever renders blank.
 *
 * `t` has no interpolation, hence the per-platform keys: there are exactly two
 * platforms, so a suffix beats a placeholder.
 */
function localize(
  notification: AppNotification,
  t: Translate
): { title: string; body: string | null } {
  const platform =
    (notification.metadata?.target as string) === "farcaster" ? "Farcaster" : "Instagram";

  // A missing key resolves to the key path itself (see LocaleContext), which is
  // how we detect "not translated" and fall back.
  const tr = (key: string): string | null => {
    const value = t(key);
    return value === `notificationsPage.crosspost.${key}` ? null : value;
  };

  const note = (notification.metadata?.note as string | undefined) || null;
  const noteLabel = tr("rejectedNoteLabel");

  switch (notification.type) {
    case "crosspost_approved":
      return {
        title: tr(`approvedTitle${platform}`) ?? notification.title,
        body: tr(`approvedBody${platform}`) ?? notification.body,
      };
    case "crosspost_rejected":
      return {
        title: tr(`rejectedTitle${platform}`) ?? notification.title,
        // The curator's reason is free text in whatever language they wrote —
        // only the label around it can be localized.
        body: note
          ? `${noteLabel ?? "Curation team:"} "${note}"`
          : tr("rejectedBodyNoNote") ?? notification.body,
      };
    case "crosspost_failed":
      return {
        title: tr(`failedTitle${platform}`) ?? notification.title,
        // The body is the platform's own error string — untranslatable, and
        // more useful raw than paraphrased.
        body: notification.body,
      };
    default:
      return { title: notification.title, body: notification.body };
  }
}

interface AppNotificationItemProps {
  notification: AppNotification;
  /** Overrides the read_at check. The page marks everything read on open, so
   *  it passes what was unread when the user ARRIVED — otherwise the accent
   *  bar would vanish before they'd read anything. */
  isNew?: boolean;
}

export default function AppNotificationItem({
  notification,
  isNew: isNewOverride,
}: AppNotificationItemProps) {
  const t = useTranslations("notificationsPage.crosspost");
  const style = TYPE_STYLE[notification.type] ?? { icon: FaBell, color: "primary" };
  const isNew = isNewOverride ?? !notification.read_at;
  const { title, body } = localize(notification, t);
  // created_at is an ISO timestamp from Postgres; formatNotificationDate is
  // shared with the Hive list so both halves read the same way.
  const formattedDate = formatNotificationDate(notification.created_at);

  return (
    <VStack
      spacing={{ base: 2, md: 3 }}
      p={{ base: 2, md: 3 }}
      bg="muted"
      w="full"
      align="stretch"
      position="relative"
      _before={
        isNew
          ? {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: { base: "3px", md: "4px" },
              background: "var(--chakra-colors-accent)",
            }
          : {}
      }
    >
      <HStack spacing={{ base: 2, md: 3 }} align="flex-start" w="full">
        <Icon as={style.icon} color={style.color} boxSize={{ base: 4, md: 5 }} mt="2px" />

        <Box flex="1" minW={0}>
          <Text
            fontSize={{ base: "sm", md: "sm" }}
            fontWeight="bold"
            color={isNew ? "accent" : "primary"}
          >
            {title}
          </Text>

          {body && (
            <Text fontSize="sm" color="text" mt={1} whiteSpace="pre-wrap" wordBreak="break-word">
              {body}
            </Text>
          )}

          {notification.link && (
            <Link
              href={notification.link}
              isExternal={/^https?:\/\//.test(notification.link)}
              color="accent"
              fontSize="xs"
              mt={1}
              display="inline-block"
              wordBreak="break-all"
            >
              {notification.type === "crosspost_approved" ? t("seePost") : notification.link}
            </Link>
          )}

          <Text fontSize="xs" color="primary" opacity={0.7} mt={1}>
            {formattedDate}
          </Text>
        </Box>
      </HStack>
    </VStack>
  );
}
