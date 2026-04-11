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
  Icon,
  Image,
} from "@chakra-ui/react";
import { FiImage, FiX } from "react-icons/fi";
import SkateModal from "@/components/shared/SkateModal";
import { ReportFormData, ReportOptions, ReportType } from "@/types/report";
import { useHiveUser } from "@/contexts/UserContext";
import { useAioha } from "@aioha/react-ui";

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
  const { hiveUser } = useHiveUser();
  const { user: aiohaUser } = useAioha();
  const reporter = hiveUser?.name ?? aiohaUser ?? "anonymous";

  const [form, setForm] = useState<ReportFormData>(() => buildInitialForm(initialData));
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialForm(initialData));
      setStatus("idle");
      setImagePreview(null);
      setImageError(null);
    }
  }, [isOpen, initialData]);

  function handlePaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImageError("Image must be under 2MB");
      return;
    }
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setForm((f) => ({ ...f, screenshot: base64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImagePreview(null);
    setImageError(null);
    setForm((f) => ({ ...f, screenshot: undefined }));
  }

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
    setImagePreview(null);
    setImageError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) return;

    setIsLoading(true);
    setStatus("idle");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/trello/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reporter }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Failed to submit");

      setStatus("success");
      closeTimerRef.current = setTimeout(handleClose, 2000);
    } catch (err) {
      console.error("Report submission failed:", err);
      setStatus("error");
    } finally {
      clearTimeout(timeoutId);
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
      resizable
    >
      <Box p={4} h="full" display="flex" flexDirection="column">
        <VStack gap={4} align="stretch" flex="1">
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
            placeholder="Describe the problem or suggestion... (Ctrl+V to paste screenshot)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            onPaste={handlePaste}
            flex="1"
            minH="80px"
            resize="none"
            isDisabled={isLoading}
            color="text"
          />

          {/* Screenshot upload */}
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setImageError("Image must be under 2MB");
                  return;
                }
                setImageError(null);
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = reader.result as string;
                  setImagePreview(base64);
                  setForm((f) => ({ ...f, screenshot: base64 }));
                };
                reader.readAsDataURL(file);
              }}
            />
            {imagePreview ? (
              <Box position="relative" display="inline-block">
                <Image src={imagePreview} alt="Screenshot preview" maxH="120px" borderRadius="md" border="1px solid" borderColor="primary" />
                <Button position="absolute" top={1} right={1} size="xs" onClick={handleRemoveImage} isDisabled={isLoading} aria-label="Remove">
                  <Icon as={FiX} />
                </Button>
              </Box>
            ) : (
              <Box
                as="button"
                display="flex"
                alignItems="center"
                gap={2}
                px={3}
                py={2}
                border="1px dashed"
                borderColor="border"
                borderRadius="md"
                color="dim"
                fontSize="sm"
                cursor="pointer"
                w="full"
                _hover={{ borderColor: "primary", color: "text" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon as={FiImage} />
                Attach Screenshot
              </Box>
            )}
            {imageError && <Text fontSize="xs" color="red.400" mt={1}>{imageError}</Text>}
          </Box>

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
