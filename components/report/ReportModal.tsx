// components/report/ReportModal.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Text,
  Box,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { ReportFormData, ReportOptions, ReportType } from "@/types/report";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ReportOptions;
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "feedback", label: "Feedback" },
];

function buildInitialForm(initialData?: ReportOptions): ReportFormData {
  return {
    title: initialData?.prefillTitle ?? "",
    description: initialData?.prefillDescription ?? "",
    type: initialData?.type ?? "bug",
    errorStack: initialData?.errorStack,
    pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined,
  };
}

export function ReportModal({ isOpen, onClose, initialData }: ReportModalProps) {
  const [form, setForm] = useState<ReportFormData>(() => buildInitialForm(initialData));
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed form whenever modal opens with new initialData
  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialForm(initialData));
      setStatus("idle");
    }
  }, [isOpen, initialData]);

  // Cleanup pending auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setForm(buildInitialForm());
    setStatus("idle");
    onClose();
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) return;

    setIsLoading(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/trello/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Failed to submit");

      setStatus("success");
      closeTimerRef.current = setTimeout(handleClose, 2000);
    } catch {
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  }

  const footer = (
    <HStack justify="flex-end" w="full" gap={2}>
      <Button variant="ghost" onClick={handleClose} isDisabled={isLoading} size="sm">
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        isLoading={isLoading}
        isDisabled={!form.title.trim() || !form.description.trim()}
        loadingText="Sending..."
        size="sm"
      >
        Submit
      </Button>
    </HStack>
  );

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleClose}
      title="report_bug.exe"
      windowId="report-modal"
      footer={footer}
    >
      <Box p={4}>
        <VStack gap={4} align="stretch">
          {/* Type selector */}
          <HStack gap={2} flexWrap="wrap">
            {REPORT_TYPES.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={form.type === t.value ? "solid" : "outline"}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                isDisabled={isLoading}
              >
                {t.label}
              </Button>
            ))}
          </HStack>

          {/* Title */}
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            isDisabled={isLoading}
            color="text"
          />

          {/* Description */}
          <Textarea
            placeholder="Describe the problem or suggestion..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            isDisabled={isLoading}
            color="text"
          />

          {/* Stack trace preview (read-only, only when auto-filled) */}
          {form.errorStack && (
            <Box
              as="pre"
              fontSize="xs"
              p={2}
              borderRadius="md"
              bg="blackAlpha.400"
              overflowX="auto"
              maxH="80px"
              color="gray.400"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
            >
              {form.errorStack.slice(0, 500)}
              {form.errorStack.length > 500 ? "…" : ""}
            </Box>
          )}

          {/* Status feedback */}
          {status === "success" && (
            <Text fontSize="sm" color="green.400">
              Report sent successfully!
            </Text>
          )}
          {status === "error" && (
            <Text fontSize="sm" color="red.400">
              Error sending. Please try again.
            </Text>
          )}
        </VStack>
      </Box>
    </SkateModal>
  );
}

export default ReportModal;
