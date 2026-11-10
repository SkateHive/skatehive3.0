"use client";
import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Link,
  ListItem,
  OrderedList,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FaAndroid, FaApple, FaGooglePlay } from "react-icons/fa";
import { useTranslations } from "@/lib/i18n/hooks";

export const APP_STORE_URL = "https://apps.apple.com/app/id6751173076";
// Always the newest GitHub release: the asset keeps the same name across versions.
export const ANDROID_APK_URL =
  "https://github.com/SkateHive/mobileapp/releases/latest/download/skatehive.apk";
const ANDROID_RELEASES_URL = "https://github.com/SkateHive/mobileapp/releases/latest";
// Set once the app is live on Google Play; until then the Play button shows "coming soon".
const PLAY_STORE_URL: string | null = null;

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return "other";
}

function StoreCard({
  title,
  highlighted,
  children,
}: {
  title: string;
  highlighted: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="panel"
      border="2px solid"
      borderColor={highlighted ? "primary" : "border"}
      rounded="lg"
      p={6}
    >
      <VStack align="stretch" spacing={4}>
        <Heading as="h2" size="md" color="primary">
          {title}
        </Heading>
        {children}
      </VStack>
    </Box>
  );
}

export default function DownloadPageClient() {
  const t = useTranslations("download");
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => setPlatform(detectPlatform()), []);

  const ios = (
    <StoreCard key="ios" title="iPhone" highlighted={platform === "ios"}>
      <Text color="text">{t("iosBody")}</Text>
      <Button as={Link} href={APP_STORE_URL} isExternal leftIcon={<FaApple />} bg="primary" color="background" size="lg">
        {t("appStore")}
      </Button>
    </StoreCard>
  );

  const android = (
    <StoreCard key="android" title="Android" highlighted={platform === "android"}>
      <Text color="text">{t("androidBody")}</Text>
      <Button as="a" href={ANDROID_APK_URL} leftIcon={<FaAndroid />} bg="primary" color="background" size="lg">
        {t("downloadApk")}
      </Button>
      {PLAY_STORE_URL ? (
        <Button as={Link} href={PLAY_STORE_URL} isExternal leftIcon={<FaGooglePlay />} variant="outline" borderColor="primary" color="primary">
          {t("googlePlay")}
        </Button>
      ) : (
        <HStack color="textSecondary" spacing={2}>
          <FaGooglePlay />
          <Text>{t("googlePlay")}</Text>
          <Badge colorScheme="green">{t("comingSoon")}</Badge>
        </HStack>
      )}
      <Box>
        <Text color="primary" fontWeight="bold" mb={2}>
          {t("howToInstall")}
        </Text>
        <OrderedList color="text" spacing={1} fontSize="sm">
          <ListItem>{t("step1")}</ListItem>
          <ListItem>{t("step2")}</ListItem>
          <ListItem>{t("step3")}</ListItem>
          <ListItem>{t("step4")}</ListItem>
        </OrderedList>
      </Box>
      <Text color="textSecondary" fontSize="xs">
        {t("apkNote")}{" "}
        <Link href={ANDROID_RELEASES_URL} isExternal color="primary">
          {t("releaseNotes")}
        </Link>
      </Text>
    </StoreCard>
  );

  return (
    <Box bg="background" minH="100vh" py={12}>
      <Container maxW="4xl">
        <VStack spacing={2} mb={8} align="start">
          <Heading as="h1" size="2xl" color="primary">
            {t("title")}
          </Heading>
          <Text color="text" fontSize="lg">
            {t("subtitle")}
          </Text>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {platform === "ios" ? [ios, android] : [android, ios]}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
