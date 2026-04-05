// components/report/ReportModal.tsx

"use client";

import { useState } from "react";
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
import { ReportFormData, ReportType } from "@/types/report";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "feedback", label: "Feedback" },
];

const INITIAL_FORM: ReportFormData = {
  title: "",
  description: "",
  type: "bug",
};

export function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [form, setForm] = useState<ReportFormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function handleClose() {
    setForm(INITIAL_FORM);
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
      setTimeout(handleClose, 2000);
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
