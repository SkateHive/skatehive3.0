"use client";

import { Box, Drawer, DrawerContent, DrawerOverlay, Flex, Icon, Text } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import type { IconType } from "react-icons";
import { FiChevronRight } from "react-icons/fi";
import { IoCreateOutline, IoGameControllerOutline, IoLocationOutline } from "react-icons/io5";
import { useTranslations } from "@/lib/i18n/hooks";
import { OPEN_TARGETS, requestOpenFromQuery } from "@/hooks/useOpenFromQuery";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  handle?: string | null;
}

interface Choice {
  key: string;
  icon: IconType;
  title: string;
  subtitle: string;
  path: string;
  // Opens a dialog on the target page (see useOpenFromQuery).
  query?: { param: string; value: string };
  primary?: boolean;
}

// Bottom sheet behind the mobile "+" tab, same as the native app's create
// sheet: Post, Spot and Play (Coach Fred's dice game).
export default function CreateSheet({ isOpen, onClose, handle }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("createSheet");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");

  const choices: Choice[] = [
    {
      key: "post",
      icon: IoCreateOutline,
      title: t("postTitle"),
      subtitle: t("postSubtitle"),
      path: "/compose",
      primary: true,
    },
    {
      key: "spot",
      icon: IoLocationOutline,
      title: t("spotTitle"),
      subtitle: t("spotSubtitle"),
      path: "/map",
      query: OPEN_TARGETS.addSpot,
    },
    {
      key: "play",
      icon: IoGameControllerOutline,
      title: t("playTitle"),
      subtitle: t("playSubtitle"),
      path: "/tricks",
      query: OPEN_TARGETS.playDice,
    },
  ];

  const choose = (choice: Choice) => {
    onClose();
    if (!choice.query) {
      router.push(choice.path);
    } else if (pathname === choice.path) {
      // Already on the page: it won't remount, so ask it to open the dialog.
      requestOpenFromQuery(choice.query);
    } else {
      router.push(`${choice.path}?${choice.query.param}=${choice.query.value}`);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="bottom">
      <DrawerOverlay bg="blackAlpha.700" />
      <DrawerContent
        aria-label={tNav("create")}
        bg="background"
        borderTopRadius="24px"
        border="1px solid"
        borderBottom="none"
        borderColor="primary"
        px={6}
        pt="10px"
        pb="calc(14px + env(safe-area-inset-bottom))"
      >
        <Box w="40px" h="5px" borderRadius="3px" bg="dim" opacity={0.6} mx="auto" mb={4} />

        <Flex align="center" justify="space-between" mb={2}>
          <Text fontWeight="bold" fontSize="sm" letterSpacing="0.2em" textTransform="uppercase" color="primary">
            {tNav("create")}
          </Text>
          {handle && (
            <Text fontSize="sm" color="dim">
              @{handle}
            </Text>
          )}
        </Flex>

        {choices.map((choice, i) => (
          <Box key={choice.key} borderTop={i > 0 ? "1px solid" : "none"} borderColor="border">
            <Flex
              as="button"
              type="button"
              w="full"
              align="center"
              gap={4}
              py="14px"
              textAlign="left"
              onClick={() => choose(choice)}
              _active={{ opacity: 0.7 }}
            >
              <Flex
                w="56px"
                h="56px"
                flexShrink={0}
                borderRadius="14px"
                align="center"
                justify="center"
                bg={choice.primary ? "primary" : "transparent"}
                border="1px solid"
                borderColor="primary"
                boxShadow={choice.primary ? "0 0 12px var(--chakra-colors-primary)" : "none"}
              >
                <Icon as={choice.icon} boxSize="26px" color={choice.primary ? "background" : "primary"} />
              </Flex>
              <Box flex="1" minW={0}>
                <Text fontWeight="bold" fontSize="xl" color="text" lineHeight="1.2">
                  {choice.title}
                </Text>
                <Text fontSize="sm" color="dim" noOfLines={1}>
                  {choice.subtitle}
                </Text>
              </Box>
              <Icon as={FiChevronRight} boxSize={5} color="dim" />
            </Flex>
          </Box>
        ))}

        <Box
          as="button"
          type="button"
          onClick={onClose}
          mt={3}
          w="full"
          py={4}
          borderRadius="16px"
          border="1px solid"
          borderColor="border"
          bg="panel"
          color="dim"
          fontWeight="bold"
          fontSize="lg"
          _active={{ opacity: 0.7 }}
        >
          {tCommon("cancel")}
        </Box>
      </DrawerContent>
    </Drawer>
  );
}
