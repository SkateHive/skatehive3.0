"use client";

import { useCallback, useEffect, useRef } from "react";
import { useToast, Box, HStack, Text, Button, CloseButton } from "@chakra-ui/react";
import { useReport } from "@/contexts/ReportContext";
import { useTranslations } from "@/lib/i18n/hooks";

export interface ErrorToastOptions {
  title: string;
  description?: string;
  isTechnical?: boolean;
  errorContext?: {
    prefillTitle?: string;
    prefillDescription?: string;
    errorStack?: string;
  };
}

interface TechnicalErrorToastProps {
  title: string;
  description?: string;
  onClose: () => void;
  onReport: () => void;
  onReportWithScreenshot: () => void;
  reportBugLabel: string;
  screenshotHintLabel: string;
}

function TechnicalErrorToast({
  title,
  description,
  onClose,
  onReport,
  onReportWithScreenshot,
  reportBugLabel,
  screenshotHintLabel,
}: TechnicalErrorToastProps) {
  // Keep a stable ref to the latest callback so the effect never re-registers
  const onReportWithScreenshotRef = useRef(onReportWithScreenshot);
  onReportWithScreenshotRef.current = onReportWithScreenshot;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        onReportWithScreenshotRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Box
      bg="red.900"
      border="1px solid"
      borderColor="red.600"
      borderRadius="md"
      p={3}
      maxW="sm"
      shadow="lg"
    >
      <HStack justify="space-between" align="start" mb={description ? 1 : 0}>
        <Text fontWeight="semibold" fontSize="sm" color="white">
          {title}
        </Text>
        <CloseButton size="sm" color="white" onClick={onClose} />
      </HStack>
      {description && (
        <Text fontSize="xs" color="red.200" mb={2}>
          {description}
        </Text>
      )}
      <HStack justify="space-between" align="center" mt={2}>
        <Button
          size="xs"
          variant="outline"
          colorScheme="red"
          borderColor="red.400"
          color="red.200"
          _hover={{ bg: "red.800", color: "white" }}
          onClick={onReport}
        >
          {reportBugLabel}
        </Button>
        <Text fontSize="10px" color="red.400">
          {screenshotHintLabel}
        </Text>
      </HStack>
    </Box>
  );
}

let isCapturing = false;

async function captureScreenshot(): Promise<string | undefined> {
  try {
    const { toJpeg } = await import("html-to-image");
    return await toJpeg(document.body, { quality: 0.6, cacheBust: true });
  } catch {
    return undefined;
  }
}

export function useErrorToast() {
  const toast = useToast();
  const { openReport } = useReport();
  const t = useTranslations("errorToast");

  const showError = useCallback(
    (opts: ErrorToastOptions) => {
      const { title, description, isTechnical = false, errorContext } = opts;

      if (!isTechnical) {
        toast({
          title,
          description,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      toast({
        duration: null,
        isClosable: true,
        render: ({ onClose }) => {
          const handleReport = () => {
            onClose();
            openReport({
              type: "bug",
              prefillTitle: errorContext?.prefillTitle,
              prefillDescription: errorContext?.prefillDescription,
              errorStack: errorContext?.errorStack,
            });
          };

          const handleReportWithScreenshot = async () => {
            if (isCapturing) return;
            isCapturing = true;
            onClose();
            const screenshot = await captureScreenshot();
            // ~2MB in base64 ≈ 2.7M chars
            const safeScreenshot = screenshot && screenshot.length < 2_700_000
              ? screenshot
              : undefined;
            openReport({ type: "bug", ...errorContext, screenshot: safeScreenshot });
            isCapturing = false;
          };

          return (
            <TechnicalErrorToast
              title={title}
              description={description}
              onClose={onClose}
              onReport={handleReport}
              onReportWithScreenshot={handleReportWithScreenshot}
              reportBugLabel={t("reportBug")}
              screenshotHintLabel={t("screenshotHint")}
            />
          );
        },
      });
    },
    [toast, openReport, t]
  );

  return showError;
}
