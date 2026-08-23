"use client";

import { Box, Text } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface Props {
  url?: string;
}

export default function TrickTutorial({ url }: Props) {
  const t = useTranslations();
  if (!url) return null;

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <Box mb={8}>
      <Text fontSize="lg" fontWeight="bold" color="text" mb={3}>
        {t("trickTutorial.sectionTitle")}
      </Text>
      <Box
        w="100%"
        sx={{ aspectRatio: "16 / 9" }}
        overflow="hidden"
        border="1px solid"
        borderColor="muted"
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={t("trickTutorial.sectionTitle")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>
    </Box>
  );
}
