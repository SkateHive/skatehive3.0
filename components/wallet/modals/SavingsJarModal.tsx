import { useEffect, useState } from "react";
import {
  VStack,
  HStack,
  Box,
  Text,
  Input,
  Checkbox,
  Button,
  SimpleGrid,
  useToast,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslations } from "@/contexts/LocaleContext";
import type { JarInput, SavingsJar } from "@/hooks/wallet/useSavingsJars";

interface SavingsJarModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Existing jar when editing; omit to create a new one. */
  jar?: SavingsJar | null;
  onSave: (input: JarInput) => Promise<{ success: boolean; error?: string }>;
}

const EMOJI_PRESETS = ["🐷", "🛹", "✈️", "🏆", "🎯", "🛼", "👟", "📷", "💸", "🏠"];
const COLOR_PRESETS = ["#34d399", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899"];

/** Goal templates: picking one pre-fills the jar (Nubank-style guided create). */
const TEMPLATES = [
  { key: "tplDeck", hintKey: "tplDeckHint", icon: "🛹", target: "60", color: "#34d399" },
  { key: "tplTrip", hintKey: "tplTripHint", icon: "✈️", target: "300", color: "#3b82f6" },
  { key: "tplContest", hintKey: "tplContestHint", icon: "🏆", target: "25", color: "#f59e0b" },
  { key: "tplScratch", hintKey: "tplScratchHint", icon: "🐷", target: "", color: "#a855f7" },
] as const;

type Step = 1 | 2 | 3;

/**
 * Create/edit a cofrinho as a 3-step guided flow:
 * 1. what are you saving for? (templates) → 2. name/goal/deadline → 3. cover.
 * Editing an existing jar starts at step 2.
 */
export function SavingsJarModal({ isOpen, onClose, jar, onSave }: SavingsJarModalProps) {
  const t = useTranslations("cofrinhos");
  const isMobile = useIsMobile();
  const toast = useToast();
  const editing = !!jar;

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("🐷");
  const [color, setColor] = useState("#34d399");
  const [isWishlist, setIsWishlist] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(jar ? 2 : 1);
      setName(jar?.name ?? "");
      setTarget(jar?.target_hbd != null ? String(jar.target_hbd) : "");
      setDeadline(jar?.deadline ?? "");
      setIcon(jar?.icon ?? "🐷");
      setColor(jar?.color ?? "#34d399");
      setIsWishlist(jar?.is_wishlist ?? false);
    }
  }, [isOpen, jar]);

  const pickTemplate = (template: (typeof TEMPLATES)[number]) => {
    setName(template.key === "tplScratch" ? "" : t(template.key));
    setTarget(template.target);
    setIcon(template.icon);
    setColor(template.color);
    setStep(2);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: JarInput = {
        name: name.trim(),
        target_hbd: target ? parseFloat(target) : null,
        deadline: deadline || null,
        icon,
        color,
        is_wishlist: isWishlist,
      };
      const result = await onSave(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to save jar");
      }
      if (!editing) {
        toast({ title: t("createdToast"), status: "success", duration: 3500, isClosable: true });
      }
      onClose();
    } catch (error: any) {
      toast({
        title: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepLabel = (
    <HStack spacing={1.5} mb={4}>
      {([1, 2, 3] as Step[]).map((s) => (
        <Box
          key={s}
          flex={1}
          h="3px"
          bg={step >= s ? "primary" : "muted"}
          opacity={editing && s === 1 ? 0.25 : 1}
        />
      ))}
    </HStack>
  );

  // Footer only renders on steps 2–3; on step 2 while editing, back = cancel.
  const backCloses = step === 2 && editing;
  const footer = (
    <HStack spacing={3} justify="space-between" width="100%">
      <Button
        variant="ghost"
        color="dim"
        fontFamily="mono"
        borderRadius="none"
        onClick={() => {
          if (backCloses) onClose();
          else setStep((step - 1) as Step);
        }}
        isDisabled={saving}
      >
        {backCloses ? t("deleteNo") : "‹"}
      </Button>
      {step === 2 && (
        <Button
          onClick={() => setStep(3)}
          bg="primary"
          color="background"
          borderRadius="none"
          fontFamily="mono"
          fontWeight="black"
          isDisabled={!name.trim()}
          _hover={{ bg: "accent" }}
        >
          {t("continueCta")} ›
        </Button>
      )}
      {step === 3 && (
        <Button
          onClick={handleSave}
          bg="primary"
          color="background"
          borderRadius="none"
          fontFamily="mono"
          fontWeight="black"
          isLoading={saving}
          isDisabled={!name.trim()}
          _hover={{ bg: "accent" }}
        >
          {editing ? t("saveChangesCta") : `${t("createCta")} 🎉`}
        </Button>
      )}
    </HStack>
  );

  const fieldLabel = (text: string) => (
    <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
      {text}
    </Text>
  );

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("editTitle") : t("newJar")}
      size={isMobile ? "full" : "md"}
      footer={step === 1 ? undefined : footer}
    >
      <Box p={4}>
        {stepLabel}

        {step === 1 && (
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="md" fontWeight="black" color="text" fontFamily="mono">
                {t("whatFor")}
              </Text>
              <Text fontSize="xs" color="dim" fontFamily="mono" mt={1} lineHeight="tall">
                {t("whatForHint")}
              </Text>
            </Box>
            <SimpleGrid columns={2} spacing={2.5}>
              {TEMPLATES.map((template) => (
                <Button
                  key={template.key}
                  onClick={() => pickTemplate(template)}
                  variant="unstyled"
                  h="auto"
                  p={3}
                  bg="panel"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="none"
                  display="flex"
                  flexDirection="column"
                  alignItems="flex-start"
                  gap={1.5}
                  whiteSpace="normal"
                  textAlign="left"
                  _hover={{ borderColor: "primary" }}
                >
                  <Text fontSize="2xl" lineHeight={1}>
                    {template.icon}
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color="text" fontFamily="mono">
                    {t(template.key)}
                  </Text>
                  <Text fontSize="2xs" color="dim" fontFamily="mono">
                    {t(template.hintKey)}
                  </Text>
                </Button>
              ))}
            </SimpleGrid>
          </VStack>
        )}

        {step === 2 && (
          <VStack spacing={4} align="stretch">
            <Text fontSize="md" fontWeight="black" color="text" fontFamily="mono">
              {t("nameTitle")}
            </Text>
            <Box>
              {fieldLabel(t("nameLabel"))}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                maxLength={60}
                bg="muted"
                border="1px solid"
                borderColor="border"
                color="text"
                autoFocus
              />
            </Box>
            <Box>
              {fieldLabel(t("goalLabel"))}
              <Input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="60"
                min={0}
                step="any"
                bg="muted"
                border="1px solid"
                borderColor="border"
                color="text"
              />
            </Box>
            <Box>
              {fieldLabel(t("deadlineLabel"))}
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                bg="muted"
                border="1px solid"
                borderColor="border"
                color="text"
              />
            </Box>
            <Checkbox
              isChecked={isWishlist}
              onChange={(e) => setIsWishlist(e.target.checked)}
              colorScheme="orange"
            >
              <Text fontSize="sm" color="text" fontFamily="mono">
                {t("wishlistLabel")}
              </Text>
            </Checkbox>
          </VStack>
        )}

        {step === 3 && (
          <VStack spacing={4} align="stretch">
            <Text fontSize="md" fontWeight="black" color="text" fontFamily="mono">
              {t("coverTitle")}
            </Text>
            <Box>
              {fieldLabel(t("iconLabel"))}
              <HStack spacing={1} flexWrap="wrap">
                {EMOJI_PRESETS.map((emoji) => (
                  <Box
                    key={emoji}
                    as="button"
                    fontSize="lg"
                    p={1}
                    border="2px solid"
                    borderColor={icon === emoji ? "primary" : "transparent"}
                    bg={icon === emoji ? "muted" : "transparent"}
                    onClick={() => setIcon(emoji)}
                    aria-label={emoji}
                  >
                    {emoji}
                  </Box>
                ))}
              </HStack>
            </Box>
            <Box>
              {fieldLabel(t("colorLabel"))}
              <HStack spacing={2}>
                {COLOR_PRESETS.map((preset) => (
                  <Box
                    key={preset}
                    as="button"
                    w="24px"
                    h="24px"
                    borderRadius="full"
                    bg={preset}
                    border="2px solid"
                    borderColor={color === preset ? "text" : "transparent"}
                    onClick={() => setColor(preset)}
                    aria-label={preset}
                  />
                ))}
              </HStack>
            </Box>
            <Box>
              {fieldLabel(t("previewLabel"))}
              <Box p={3} bg="panel" border="1px solid" borderColor="border" borderTop="3px solid" borderTopColor={color}>
                <Text fontSize="xl" lineHeight={1} mb={1}>
                  {icon}
                </Text>
                <Text fontSize="sm" fontWeight="bold" color="text" fontFamily="mono" mb={1}>
                  {name || "—"}
                </Text>
                <Text
                  fontSize="sm"
                  fontWeight="black"
                  fontFamily="mono"
                  color={color}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  0.000{" "}
                  {target ? `/ ${parseFloat(target).toFixed(3)} ` : ""}
                  <Text as="span" fontSize="2xs" color="dim" fontWeight="normal">
                    HBD
                  </Text>
                </Text>
              </Box>
            </Box>
          </VStack>
        )}
      </Box>
    </SkateModal>
  );
}
