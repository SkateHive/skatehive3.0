// components/report/ReportModal.tsx

"use client";

import { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Text,
} from "@chakra-ui/react";
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

      if (!response.ok) throw new Error("Falha ao enviar");

      setStatus("success");
      setTimeout(handleClose, 2000);
    } catch {
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="panel" borderColor="border" borderWidth={1}>

        <ModalHeader color="text">Reportar problema</ModalHeader>
        <ModalCloseButton color="text" />

        <ModalBody>
          <VStack gap={4} align="stretch">

            {/* Tipo */}
            <HStack gap={2}>
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

            {/* Título */}
            <Input
              placeholder="Título"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              isDisabled={isLoading}
              color="text"
            />

            {/* Descrição */}
            <Textarea
              placeholder="Descreva o problema ou sugestão..."
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={4}
              isDisabled={isLoading}
              color="text"
            />

            {/* Feedback de status */}
            {status === "success" && (
              <Text fontSize="sm" color="green.400">
                Report enviado com sucesso!
              </Text>
            )}
            {status === "error" && (
              <Text fontSize="sm" color="red.400">
                Erro ao enviar. Tente novamente.
              </Text>
            )}

          </VStack>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={handleClose} isDisabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            isDisabled={!form.title.trim() || !form.description.trim()}
            loadingText="Enviando..."
          >
            Enviar
          </Button>
        </ModalFooter>

      </ModalContent>
    </Modal>
  );
}

export default ReportModal;