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
import { formatNotificationDate } from "./utils";

const TYPE_STYLE: Record<
  string,
  { icon: typeof FaBell; color: string }
> = {
  crosspost_approved: { icon: FaCheckCircle, color: "green.400" },
  crosspost_rejected: { icon: FaTimesCircle, color: "orange.400" },
  crosspost_failed: { icon: FaExclamationTriangle, color: "red.400" },
};

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
  const style = TYPE_STYLE[notification.type] ?? { icon: FaBell, color: "primary" };
  const isNew = isNewOverride ?? !notification.read_at;
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
            {notification.title}
          </Text>

          {notification.body && (
            <Text fontSize="sm" color="text" mt={1} whiteSpace="pre-wrap" wordBreak="break-word">
              {notification.body}
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
              {notification.type === "crosspost_approved" ? "See the post →" : notification.link}
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
