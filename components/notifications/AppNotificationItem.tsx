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
import {
  FaBell,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaRegClock,
  FaTimesCircle,
} from "react-icons/fa";
import type { AppNotification } from "@/contexts/NotificationContext";
import { useTranslations } from "@/lib/i18n/hooks";
import { useLocale } from "@/contexts/LocaleContext";
import {
  CROSSPOST_NOTIF_NS,
  localizeCrossPostNotification,
} from "@/lib/notifications/localizeCrossPost";
import { formatNotificationDate } from "./utils";

const TYPE_STYLE: Record<
  string,
  { icon: typeof FaBell; color: string }
> = {
  crosspost_queued: { icon: FaHourglassHalf, color: "blue.300" },
  crosspost_scheduled: { icon: FaRegClock, color: "purple.300" },
  crosspost_published: { icon: FaCheckCircle, color: "green.400" },
  crosspost_rejected: { icon: FaTimesCircle, color: "orange.400" },
  crosspost_failed: { icon: FaExclamationTriangle, color: "red.400" },
};

/** Types whose link points at the published post rather than a raw URL. */
const LINKS_TO_POST = new Set(["crosspost_published"]);


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
  const t = useTranslations(CROSSPOST_NOTIF_NS);
  const { locale } = useLocale();
  const style = TYPE_STYLE[notification.type] ?? { icon: FaBell, color: "primary" };
  const isNew = isNewOverride ?? !notification.read_at;
  // The locale is passed through so a scheduled time renders in the reader's
  // own timezone and number/date conventions, not the curator's.
  const { title, body } = localizeCrossPostNotification(notification, t, locale);
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
              {LINKS_TO_POST.has(notification.type) ? t("seePost") : notification.link}
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
