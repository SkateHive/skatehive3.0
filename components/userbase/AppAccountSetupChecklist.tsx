"use client";

/**
 * App Account setup checklist — top-of-page status panel for the
 * Settings → App Account tab.
 *
 * Surfaces every linkable / authorizable thing in one place so the user
 * can finish setup without hunting through different parts of the app:
 *   - Hive (linked? posting key stored?)
 *   - Farcaster (linked? signer approved?)
 *   - EVM wallet (any linked?)
 *   - Instagram handle (set?)
 *
 * Each row is a status badge + optional inline action. The Farcaster
 * "Authorize signer" action opens a modal with a QR code from Neynar
 * that the user scans in the Farcaster app to grant posting access.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Button,
  Center,
  HStack,
  Heading,
  Icon,
  Image,
  Input,
  Link as ChakraLink,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { CheckCircleIcon, WarningIcon } from "@chakra-ui/icons";
import { SiFarcaster } from "react-icons/si";
import { FaInstagram, FaWallet, FaKey } from "react-icons/fa";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useFarcasterSigner } from "@/hooks/useFarcasterSigner";

// ---------------------------------------------------------------------------
// Types

interface IdentityRow {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  metadata: Record<string, any>;
}

interface PostingKeyStatus {
  stored: boolean;
}

// ---------------------------------------------------------------------------
// Hooks / data loading

/**
 * Pulls everything the checklist needs in one place: identities + stored
 * posting key status. Returns a `refresh` to re-fetch after the user
 * completes a setup step.
 */
function useChecklistData() {
  const { user } = useUserbaseAuth();
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [postingKey, setPostingKey] = useState<PostingKeyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setIdentities([]);
      setPostingKey(null);
      return;
    }
    setIsLoading(true);
    try {
      const [identitiesRes, keyRes] = await Promise.all([
        fetch("/api/userbase/identities", { cache: "no-store" }),
        fetch("/api/userbase/keys/posting", { cache: "no-store" }),
      ]);
      const identitiesData = await identitiesRes.json().catch(() => ({}));
      const keyData = await keyRes.json().catch(() => ({}));
      if (identitiesRes.ok) setIdentities(identitiesData?.identities || []);
      if (keyRes.ok) setPostingKey({ stored: Boolean(keyData?.stored) });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { identities, postingKey, isLoading, refresh };
}

// ---------------------------------------------------------------------------
// Atomic row component — shared visual language for every checklist item

type RowStatus = "ok" | "missing" | "pending" | "loading";

function ChecklistRow({
  icon,
  title,
  detail,
  status,
  actionLabel,
  onAction,
  isActionLoading,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | React.ReactNode;
  status: RowStatus;
  actionLabel?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
}) {
  const statusIcon =
    status === "ok" ? (
      <Icon as={CheckCircleIcon} color="primary" boxSize={4} />
    ) : status === "pending" ? (
      <Spinner size="xs" color="primary" />
    ) : status === "loading" ? (
      <Spinner size="xs" color="dim" />
    ) : (
      <Icon as={WarningIcon} color="warning" boxSize={4} />
    );

  return (
    <HStack
      justify="space-between"
      align="center"
      p={3}
      borderTop="1px solid"
      borderColor="border"
      gap={3}
      _first={{ borderTop: "none" }}
    >
      <HStack spacing={3} flex="1" minW={0}>
        <Box flexShrink={0}>{statusIcon}</Box>
        <Box flexShrink={0} color="dim" w="20px" textAlign="center">
          {icon}
        </Box>
        <Box minW={0} flex="1">
          <Text fontFamily="mono" fontSize="sm" color="text" noOfLines={1}>
            {title}
          </Text>
          {detail && (
            <Text fontFamily="mono" fontSize="xs" color="dim" noOfLines={1}>
              {detail}
            </Text>
          )}
        </Box>
      </HStack>
      {actionLabel && onAction && (
        <Button
          size="xs"
          variant={status === "ok" ? "ghost" : "outline"}
          fontFamily="mono"
          fontSize="2xs"
          color={status === "ok" ? "dim" : "primary"}
          borderColor="primary"
          onClick={onAction}
          isLoading={!!isActionLoading}
        >
          {actionLabel}
        </Button>
      )}
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Farcaster signer approval — modal with QR pulled from Neynar

function SignerApprovalModal({
  isOpen,
  onClose,
  onApproved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
}) {
  const signer = useFarcasterSigner();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fired = useRef(false);

  // Kick off signer creation when the modal first opens
  useEffect(() => {
    if (isOpen && !fired.current) {
      fired.current = true;
      signer.checkOrCreateSigner();
    }
    if (!isOpen) {
      fired.current = false;
    }
  }, [isOpen, signer]);

  // Notify parent + close once Neynar reports approval
  useEffect(() => {
    if (signer.isApproved && isOpen) {
      onApproved();
      onClose();
    }
  }, [signer.isApproved, isOpen, onApproved, onClose]);

  // Render the approval URL as a QR. Dynamic import keeps qrcode out of the
  // initial bundle since most users will never open this modal.
  useEffect(() => {
    if (!signer.approvalUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(signer.approvalUrl!, {
        margin: 1,
        width: 220,
        color: { dark: "#000000", light: "#ffffff" },
      });
      if (!cancelled) setQrDataUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [signer.approvalUrl]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="background" border="1px solid" borderColor="primary">
        <ModalHeader fontFamily="mono" fontSize="sm" color="primary">
          <HStack spacing={2}>
            <Icon as={SiFarcaster} />
            <Text>Authorize Farcaster posting</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="dim" />
        <ModalBody py={4}>
          {signer.error ? (
            <VStack spacing={3}>
              <Text fontFamily="mono" fontSize="xs" color="error" textAlign="center">
                {signer.error}
              </Text>
              <Button
                size="sm"
                variant="outline"
                fontFamily="mono"
                fontSize="xs"
                borderColor="primary"
                color="primary"
                onClick={() => signer.checkOrCreateSigner()}
              >
                Try again
              </Button>
            </VStack>
          ) : signer.isLoading || (!signer.approvalUrl && !signer.isApproved) ? (
            <Center py={6}>
              <VStack spacing={2}>
                <Spinner size="md" color="primary" />
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  Creating signer…
                </Text>
              </VStack>
            </Center>
          ) : signer.approvalUrl ? (
            <VStack spacing={3}>
              <Text fontFamily="mono" fontSize="xs" color="text" textAlign="center">
                Scan with your phone to approve in the Farcaster app.
              </Text>
              {qrDataUrl ? (
                <Box bg="white" p={2} borderRadius="md">
                  <Image src={qrDataUrl} alt="Scan to approve" boxSize="220px" />
                </Box>
              ) : (
                <Spinner size="md" color="primary" />
              )}
              <HStack spacing={2}>
                <Spinner size="xs" color="primary" />
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  Waiting for approval…
                </Text>
              </HStack>
              <ChakraLink
                href={signer.approvalUrl}
                isExternal
                fontFamily="mono"
                fontSize="2xs"
                color="primary"
              >
                or open the link directly
              </ChakraLink>
            </VStack>
          ) : (
            <Center py={4}>
              <Text fontFamily="mono" fontSize="xs" color="primary">
                Signer approved ✓
              </Text>
            </Center>
          )}
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="border" py={2}>
          <Button size="xs" variant="ghost" fontFamily="mono" color="dim" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Instagram handle inline editor

function IgHandleInlineEditor({
  initial,
  onSaved,
}: {
  initial: string | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState(initial ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const handle = value.trim().replace(/^@/, "");
    if (!handle) {
      toast({ title: "Enter a handle", status: "warning", duration: 2500 });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/userbase/profile/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, source: "settings" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      toast({ title: "Instagram handle saved", status: "success", duration: 2000 });
      onSaved();
    } catch (err: any) {
      toast({
        title: "Failed to save handle",
        description: err?.message,
        status: "error",
        duration: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HStack spacing={2}>
      <Input
        size="xs"
        fontFamily="mono"
        placeholder="your.ig.handle"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        bg="background"
        borderColor="border"
        color="text"
        w="160px"
      />
      <Button
        size="xs"
        variant="outline"
        fontFamily="mono"
        fontSize="2xs"
        borderColor="primary"
        color="primary"
        onClick={save}
        isLoading={isSaving}
      >
        Save
      </Button>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Main component

export default function AppAccountSetupChecklist() {
  const { identities, postingKey, isLoading, refresh } = useChecklistData();
  const signerDisclosure = useDisclosure();
  const [igEditing, setIgEditing] = useState(false);

  const byType = useMemo(() => {
    const out: Record<string, IdentityRow[]> = {};
    for (const id of identities) {
      (out[id.type] ||= []).push(id);
    }
    return out;
  }, [identities]);

  const hive = byType.hive?.[0];
  const farcaster = byType.farcaster?.[0];
  const evmCount = byType.evm?.length || 0;
  const instagram = byType.instagram?.[0];
  const signerApproved =
    farcaster?.metadata?.signer_status === "approved";

  const completed = [
    !!hive,
    !!postingKey?.stored,
    !!farcaster,
    !!signerApproved,
    evmCount > 0,
    !!instagram?.handle,
  ].filter(Boolean).length;
  const total = 6;

  return (
    <Box border="1px solid" borderColor="muted" bg="background">
      <Box px={4} py={3} borderBottom="1px solid" borderColor="border">
        <HStack justify="space-between" align="center">
          <Heading size="sm" fontFamily="mono" color="primary">
            Complete your setup
          </Heading>
          <Text fontFamily="mono" fontSize="2xs" color="dim">
            {completed} / {total}
            {isLoading && <> · refreshing…</>}
          </Text>
        </HStack>
        <Text fontFamily="mono" fontSize="xs" color="dim" mt={1}>
          Each step unlocks a SkateHive capability. Finish what you actually need — none of them are required to use the app.
        </Text>
      </Box>

      <Box>
        <ChecklistRow
          icon={<Image src="/logos/SKATE_HIVE_CIRCLE.svg" alt="" boxSize="16px" />}
          title="Hive account linked"
          detail={hive ? `@${hive.handle}` : "Lets you post snaps that appear under your Hive name"}
          status={hive ? "ok" : "missing"}
          actionLabel={hive ? undefined : "Link Hive"}
          onAction={hive ? undefined : () => scrollToLinker()}
        />
        <ChecklistRow
          icon={<Icon as={FaKey} />}
          title="Hive posting key stored"
          detail={
            postingKey?.stored
              ? "Encrypted server-side — posts skip the Keychain popup"
              : "Optional: skips the Keychain popup when posting"
          }
          status={postingKey?.stored ? "ok" : "missing"}
          actionLabel={postingKey?.stored ? "Manage" : "Add key"}
          onAction={() => scrollTo("posting-key-panel")}
        />
        <ChecklistRow
          icon={<Icon as={SiFarcaster} color="primary" />}
          title="Farcaster account linked"
          detail={
            farcaster
              ? `@${farcaster.handle}${
                  farcaster.external_id ? ` · fid ${farcaster.external_id}` : ""
                }`
              : "Required to cross-post snaps to Farcaster"
          }
          status={farcaster ? "ok" : "missing"}
          actionLabel={farcaster ? undefined : "Link Farcaster"}
          onAction={farcaster ? undefined : () => scrollToLinker()}
        />
        <ChecklistRow
          icon={<Icon as={SiFarcaster} color="primary" />}
          title="Farcaster signer authorized"
          detail={
            !farcaster
              ? "Link your Farcaster account first"
              : signerApproved
              ? "Approved — Farcaster cross-post is ready"
              : "One-time scan in the Farcaster app to grant posting access"
          }
          status={signerApproved ? "ok" : !farcaster ? "missing" : "missing"}
          actionLabel={
            farcaster && !signerApproved ? "Authorize" : undefined
          }
          onAction={
            farcaster && !signerApproved ? signerDisclosure.onOpen : undefined
          }
        />
        <ChecklistRow
          icon={<Icon as={FaWallet} />}
          title="EVM wallet linked"
          detail={
            evmCount
              ? `${evmCount} wallet${evmCount > 1 ? "s" : ""} linked`
              : "Optional: enables NFT / on-chain features"
          }
          status={evmCount ? "ok" : "missing"}
          actionLabel={evmCount ? undefined : "Link wallet"}
          onAction={evmCount ? undefined : () => scrollToLinker()}
        />
        {igEditing ? (
          <Box p={3} borderTop="1px solid" borderColor="border">
            <HStack justify="space-between" align="start" mb={2}>
              <Text fontFamily="mono" fontSize="xs" color="dim">
                Your IG handle (we @-mention it in cross-post captions)
              </Text>
              <Button
                size="xs"
                variant="ghost"
                color="dim"
                fontFamily="mono"
                fontSize="2xs"
                onClick={() => setIgEditing(false)}
              >
                cancel
              </Button>
            </HStack>
            <IgHandleInlineEditor
              initial={instagram?.handle ?? null}
              onSaved={() => {
                setIgEditing(false);
                refresh();
              }}
            />
          </Box>
        ) : (
          <ChecklistRow
            icon={<Icon as={FaInstagram} />}
            title="Instagram handle"
            detail={
              instagram?.handle
                ? `@${instagram.handle} — used for caption @-tags`
                : "Optional: tags you in @skatehive IG cross-posts"
            }
            status={instagram?.handle ? "ok" : "missing"}
            actionLabel={instagram?.handle ? "Edit" : "Add handle"}
            onAction={() => setIgEditing(true)}
          />
        )}
      </Box>

      <SignerApprovalModal
        isOpen={signerDisclosure.isOpen}
        onClose={signerDisclosure.onClose}
        onApproved={refresh}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helpers

function scrollTo(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToLinker() {
  scrollTo("identity-linker-section");
}
