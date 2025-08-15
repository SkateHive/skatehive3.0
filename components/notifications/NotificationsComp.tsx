"use client";
import { useState } from "react";
import {
  Box,
  Text,
  Stack,
  Button,
  Flex,
  Select,
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  useBreakpointValue,
  VStack,
  HStack,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useNotifications } from "@/contexts/NotificationContext";
import NotificationItem from "./NotificationItem";

interface NotificationCompProps {
  username: string;
}

export default function NotificationsComp({ username }: NotificationCompProps) {
  const { user, aioha } = useAioha();
  const {
    notifications,
    isLoading,
    lastReadDate,
    refreshNotifications,
    markNotificationsAsRead,
  } = useNotifications();
  const [filter, setFilter] = useState<string>("all");

  async function handleMarkAsRead() {
    const now = new Date().toISOString();
    const json = JSON.stringify(["setLastRead", { date: now }]);
    await aioha.signAndBroadcastTx(
      [
        [
          "custom_json",
          {
            required_auths: [],
            required_posting_auths: [user],
            id: "notify",
            json: json,
          },
        ],
      ],
      KeyTypes.Posting
    );
    // Update the context with the new read date
    markNotificationsAsRead();
    // Refresh notifications to get the latest state
    await refreshNotifications();
  }

  // Sort notifications by date descending
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter notifications by type
  const filteredNotifications =
    filter === "all"
      ? sortedNotifications
      : sortedNotifications.filter((n) => n.type === filter);

  // Get all unique types for dropdown
  const notificationTypes = Array.from(
    new Set(notifications.map((n) => n.type))
  );

  // Add type label mapping and order
  const notificationTypeLabels: Record<string, string> = {
    reply: "Reply",
    reply_comment: "Reply to Comment",
    mention: "Mentions",
    vote: "Votes",
    follow: "Follows",
  };
  const notificationTypeOrder = [
    "reply",
    "reply_comment",
    "mention",
    "vote",
    "follow",
  ];

  // Responsive values
  const headerFontSize = useBreakpointValue({
    base: "2xl",
    md: "4xl",
    lg: "6xl",
  });
  const containerPadding = useBreakpointValue({ base: 2, md: 4 });


  return (
    <VStack
      spacing={0}
      h="100vh"
      bg="background"
      color="text"
      overflow="hidden"
    >

      {/* Header */}
      <Box
        w="full"
        px={containerPadding}
        py={4}
        bg="background"
        borderBottom="1px solid"
        borderColor="border"
      >
        <VStack spacing={3}>
          <Text
            fontSize={headerFontSize}
            fontWeight="extrabold"
            color="primary"
            textAlign="center"
            fontFamily="heading"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Notifications
          </Text>

          <Text
            color="text"
            fontSize={{ base: "xs", md: "sm" }}
            textAlign="center"
          >
          </Text>

          {/* Controls */}
          <HStack spacing={4} w="full" justify="center" flexWrap="wrap">
            <HStack spacing={2}>

              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                maxW="200px"
                mb={4}
                bg="muted"
                borderColor="border"
                color="text"
                _focus={{
                  borderColor: "primary",
                  boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
                }}
                _hover={{ borderColor: "primary" }}
              >
                <option value="all">All</option>
                {notificationTypeOrder
                  .filter((type) => notifications.some((n) => n.type === type))
                  .map((type) => (
                    <option key={type} value={type}>
                      {notificationTypeLabels[type]}
                    </option>
                  ))}
              </Select>

              {user == username && (
                <Button onClick={handleMarkAsRead} size="sm" mb={4}>
                  Mark as Read
                </Button>
              )}
            </HStack>
          </HStack>
        </VStack>
      </Box>

      <Box>


        {isLoading ? (
          <Stack spacing={4} w="full">
            {[...Array(5)].map((_, i) => (
              <Box
                key={i}
                p={3}
                borderRadius="base"
                bg="primary"
                w="full"
                minH="80px"
                display="flex"
                alignItems="center"
              >
                <SkeletonCircle
                  size="8"
                  mr={4}
                  startColor="muted"
                  endColor="primary"
                />
                <Box flex="1">
                  <Skeleton
                    height="16px"
                    width="40%"
                    mb={2}
                    startColor="muted"
                    endColor="primary"
                  />
                  <SkeletonText
                    noOfLines={2}
                    spacing={2}
                    width="80%"
                    startColor="muted"
                    endColor="primary"
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        ) : filteredNotifications.length > 0 ? (
          <Stack spacing={4} w="full">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                lastReadDate={lastReadDate}
                currentUser={username}
              />
            ))}
          </Stack>
        ) : (
          <Text>No notifications</Text>
        )}
      </Box>
    </VStack>
  );
}
