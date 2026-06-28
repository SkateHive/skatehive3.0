import { useEffect, useState } from "react";
import {
  VStack,
  HStack,
  Box,
  Text,
  Input,
  Checkbox,
} from "@chakra-ui/react";
import { BaseWalletModal } from "./BaseWalletModal";
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

/** Create or edit a savings jar (metadata only). */
export function SavingsJarModal({ isOpen, onClose, jar, onSave }: SavingsJarModalProps) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("🐷");
  const [color, setColor] = useState("#34d399");
  const [isWishlist, setIsWishlist] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(jar?.name ?? "");
      setTarget(jar?.target_hbd != null ? String(jar.target_hbd) : "");
      setDeadline(jar?.deadline ?? "");
      setIcon(jar?.icon ?? "🐷");
      setColor(jar?.color ?? "#34d399");
      setIsWishlist(jar?.is_wishlist ?? false);
    }
  }, [isOpen, jar]);

  const handleConfirm = async () => {
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
    onClose();
  };

  return (
    <BaseWalletModal
      isOpen={isOpen}
      onClose={onClose}
      title={jar ? "Edit Jar" : "New Jar"}
      onConfirm={handleConfirm}
      isConfirmDisabled={!name.trim()}
      confirmText={jar ? "Save" : "Create"}
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase">
            Name
          </Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New deck, skate trip, contest…"
            maxLength={60}
            bg="muted"
            border="1px solid"
            borderColor="border"
            color="text"
          />
        </Box>

        <Box>
          <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase">
            Goal (HBD) — optional
          </Text>
          <Input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="100"
            min={0}
            step="any"
            bg="muted"
            border="1px solid"
            borderColor="border"
            color="text"
          />
        </Box>

        <Box>
          <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase">
            Deadline — optional
          </Text>
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

        <Box>
          <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase">
            Icon
          </Text>
          <HStack spacing={1} flexWrap="wrap">
            {EMOJI_PRESETS.map((e) => (
              <Box
                key={e}
                as="button"
                fontSize="lg"
                p={1}
                borderRadius="md"
                border="2px solid"
                borderColor={icon === e ? "primary" : "transparent"}
                bg={icon === e ? "muted" : "transparent"}
                onClick={() => setIcon(e)}
              >
                {e}
              </Box>
            ))}
          </HStack>
        </Box>

        <Box>
          <Text fontSize="xs" color="dim" mb={1} fontFamily="mono" textTransform="uppercase">
            Color
          </Text>
          <HStack spacing={2}>
            {COLOR_PRESETS.map((c) => (
              <Box
                key={c}
                as="button"
                w="24px"
                h="24px"
                borderRadius="full"
                bg={c}
                border="2px solid"
                borderColor={color === c ? "text" : "transparent"}
                onClick={() => setColor(c)}
              />
            ))}
          </HStack>
        </Box>

        <Checkbox
          isChecked={isWishlist}
          onChange={(e) => setIsWishlist(e.target.checked)}
          colorScheme="orange"
        >
          <Text fontSize="sm" color="text">
            Goal only (wishlist — no money set aside)
          </Text>
        </Checkbox>
      </VStack>
    </BaseWalletModal>
  );
}
