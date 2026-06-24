"use client";

/**
 * App Account setup checklist — top-of-page status panel for the
 * Settings → App Account tab.
 *
 * Surfaces every linkable / authorizable thing in one place, AND lets the
 * user manage each item inline (unlink Hive / Farcaster, list & unlink
 * individual EVM wallets, edit IG handle, etc) so there is no separate
 * "Linked identities" listing to keep in sync.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Center,
  Collapse,
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
import { CheckCircleIcon, WarningIcon, ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
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

function useChecklistData() {
  const { user, bumpIdentitiesVersion } = useUserbaseAuth();
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

  const unlinkIdentity = useCallback(
    async (id: string) => {
      const res = await fetch("/api/userbase/identities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to unlink");
      await refresh();
      bumpIdentitiesVersion();
    },
    [refresh, bumpIdentitiesVersion]
  );

  return { identities, postingKey, isLoading, refresh, unlinkIdentity };
}

// ---------------------------------------------------------------------------
// Atomic row component

type RowStatus = "ok" | "missing" | "pending" | "loading";

function ChecklistRow({
  icon,
  title,
  detail,
  status,
  actionLabel,
  onAction,
  isActionLoading,
  manageOpen,
  onToggleManage,
  manageContent,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | React.ReactNode;
  status: RowStatus;
  actionLabel?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
  manageOpen?: boolean;
  onToggleManage?: () => void;
  manageContent?: React.ReactNode;
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
    <Box borderTop="1px solid" borderColor="border" _first={{ borderTop: "none" }}>
      <HStack justify="space-between" align="center" p={3} gap={3}>
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
        <HStack spacing={1}>
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
          {onToggleManage && manageContent && (
            <Button
              size="xs"
              variant="ghost"
              fontFamily="mono"
              fontSize="2xs"
              color="dim"
              rightIcon={manageOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              onClick={onToggleManage}
            >
              Manage
            </Button>
          )}
        </HStack>
      </HStack>
      {manageContent && (
        <Collapse in={!!manageOpen} animateOpacity>
          <Box
            px={3}
            py={3}
            bg="muted"
            borderTop="1px dashed"
            borderColor="border"
          >
            {manageContent}
          </Box>
        </Collapse>
      )}
    </Box>
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

  useEffect(() => {
    if (isOpen && !fired.current) {
      fired.current = true;
      signer.checkOrCreateSigner();
    }
    if (!isOpen) {
      fired.current = false;
    }
  }, [isOpen, signer]);

  useEffect(() => {
    if (signer.isApproved && isOpen) {
      onApproved();
      onClose();
    }
  }, [signer.isApproved, isOpen, onApproved, onClose]);

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
// Inline unlink button (used inside the Manage panels)

function UnlinkButton({
  onUnlink,
  label = "Unlink",
}: {
  onUnlink: () => Promise<void>;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="xs"
      variant="outline"
      fontFamily="mono"
      fontSize="2xs"
      borderColor="error"
      color="error"
      isLoading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onUnlink();
        } catch (err: any) {
          toast({
            title: "Unlink failed",
            description: err?.message,
            status: "error",
            duration: 3000,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

function shortAddress(addr: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Main component

type ManageKey = "hive" | "farcaster" | "evm" | null;

export default function AppAccountSetupChecklist() {
  const { identities, postingKey, isLoading, refresh, unlinkIdentity } =
    useChecklistData();
  const signerDisclosure = useDisclosure();
  const [igEditing, setIgEditing] = useState(false);
  const [manageOpen, setManageOpen] = useState<ManageKey>(null);

  const byType = useMemo(() => {
    const out: Record<string, IdentityRow[]> = {};
    for (const id of identities) {
      (out[id.type] ||= []).push(id);
    }
    return out;
  }, [identities]);

  const hive = byType.hive?.[0];
  const farcaster = byType.farcaster?.[0];
  const evmWallets = byType.evm || [];
  const evmCount = evmWallets.length;
  const instagram = byType.instagram?.[0];
  const signerApproved = farcaster?.metadata?.signer_status === "approved";

  const completed = [
    !!hive,
    !!postingKey?.stored,
    !!farcaster,
    !!signerApproved,
    evmCount > 0,
    !!instagram?.handle,
  ].filter(Boolean).length;
  const total = 6;

  const toggle = (key: Exclude<ManageKey, null>) =>
    setManageOpen((prev) => (prev === key ? null : key));

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
          Each step unlocks a SkateHive capability. Finish what you actually
          need — none of them are required to use the app.
        </Text>
      </Box>

      <Box>
        {/* Hive account */}
        <ChecklistRow
          icon={<Image src="/logos/SKATE_HIVE_CIRCLE.svg" alt="" boxSize="16px" />}
          title="Hive account linked"
          detail={
            hive
              ? `@${hive.handle}`
              : "Lets you post snaps that appear under your Hive name"
          }
          status={hive ? "ok" : "missing"}
          actionLabel={hive ? undefined : "Link Hive"}
          onAction={hive ? undefined : () => scrollToLinker()}
          manageOpen={manageOpen === "hive"}
          onToggleManage={hive ? () => toggle("hive") : undefined}
          manageContent={
            hive ? (
              <HStack justify="space-between">
                <VStack align="start" spacing={0}>
                  <Text fontFamily="mono" fontSize="xs" color="text">
                    @{hive.handle}
                  </Text>
                  <Text fontFamily="mono" fontSize="2xs" color="dim">
                    Sign-in via Hive Keychain. Unlinking removes the binding
                    but does not affect your Hive account on-chain.
                  </Text>
                </VStack>
                <UnlinkButton onUnlink={() => unlinkIdentity(hive.id)} />
              </HStack>
            ) : undefined
          }
        />

        {/* Posting key */}
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

        {/* Farcaster account */}
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
          manageOpen={manageOpen === "farcaster"}
          onToggleManage={farcaster ? () => toggle("farcaster") : undefined}
          manageContent={
            farcaster ? (
              <HStack justify="space-between">
                <VStack align="start" spacing={0}>
                  <Text fontFamily="mono" fontSize="xs" color="text">
                    @{farcaster.handle}
                    {farcaster.external_id ? ` · fid ${farcaster.external_id}` : ""}
                  </Text>
                  <Text fontFamily="mono" fontSize="2xs" color="dim">
                    Unlinking removes cross-post access. You can re-link any
                    time from a Farcaster session.
                  </Text>
                </VStack>
                <UnlinkButton onUnlink={() => unlinkIdentity(farcaster.id)} />
              </HStack>
            ) : undefined
          }
        />

        {/* Farcaster signer */}
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
          status={signerApproved ? "ok" : "missing"}
          actionLabel={farcaster && !signerApproved ? "Authorize" : undefined}
          onAction={
            farcaster && !signerApproved ? signerDisclosure.onOpen : undefined
          }
        />

        {/* EVM wallets */}
        <ChecklistRow
          icon={<Icon as={FaWallet} />}
          title="EVM wallet linked"
          detail={
            evmCount
              ? `${evmCount} wallet${evmCount > 1 ? "s" : ""} linked`
              : "Optional: enables NFT / on-chain features"
          }
          status={evmCount ? "ok" : "missing"}
          actionLabel={evmCount ? "Add another" : "Link wallet"}
          onAction={() => scrollToLinker()}
          manageOpen={manageOpen === "evm"}
          onToggleManage={evmCount ? () => toggle("evm") : undefined}
          manageContent={
            evmCount ? (
              <VStack align="stretch" spacing={2}>
                {evmWallets.map((wallet) => (
                  <HStack key={wallet.id} justify="space-between">
                    <VStack align="start" spacing={0}>
                      <Text fontFamily="mono" fontSize="xs" color="text">
                        {shortAddress(wallet.address)}
                        {wallet.is_primary && (
                          <Text as="span" color="primary" ml={2} fontSize="2xs">
                            primary
                          </Text>
                        )}
                      </Text>
                      <Text fontFamily="mono" fontSize="2xs" color="dim">
                        {wallet.address}
                      </Text>
                    </VStack>
                    <UnlinkButton onUnlink={() => unlinkIdentity(wallet.id)} />
                  </HStack>
                ))}
              </VStack>
            ) : undefined
          }
        />

        {/* Instagram handle */}
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
