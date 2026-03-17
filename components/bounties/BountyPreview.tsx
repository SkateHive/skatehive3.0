"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  Skeleton,
  Icon,
  Divider,
  Image,
  Input,
  Textarea,
  Button,
  Flex,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaEthereum, FaBolt, FaTimes } from "react-icons/fa";
import { formatEther } from "viem";
import NextLink from "next/link";
import { useState, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import imageCompression from "browser-image-compression";
import { uploadToIpfsSmart } from "@/lib/utils/ipfsUpload";
import { generateVideoIframeMarkdown, generatePermlink } from "@/lib/markdown/composeUtils";
import { CHAIN_LABEL, CHAIN_PATH } from "@/lib/poidh-constants";
import { usePoidhWrite } from "@/hooks/usePoidhWrite";
import { useHiveUser } from "@/contexts/UserContext";
import useUserbaseHiveIdentity from "@/hooks/useUserbaseHiveIdentity";
import { useAioha } from "@aioha/react-ui";
import { HIVE_CONFIG } from "@/config/app.config";
import SkateModal from "@/components/shared/SkateModal";
import ImageCompressor, { ImageCompressorRef } from "@/lib/utils/ImageCompressor";
import type { PoidhBounty } from "@/types/poidh";

interface BountyPreviewProps {
  chainId: string;
  id: string;
}

function safeFormatEther(amount: string): string {
  try {
    return formatEther(BigInt(amount));
  } catch {
    return "0";
  }
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/<[^>]*>/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\n{2,}/g, " ")
    .trim();
}

function MediaPreview({ src, maxH = "180px" }: { src: string; maxH?: string }) {
  const looksLikeVideo = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(src) || src.includes("video");
  if (looksLikeVideo) {
    return <video src={src} controls style={{ width: "100%", maxHeight: maxH }} />;
  }
  return <Box as="img" src={src} alt="Proof" w="100%" maxH={maxH} objectFit="contain" />;
}

export default function BountyPreview({ chainId, id }: BountyPreviewProps) {
  const { data: bounty, isLoading } = useQuery<PoidhBounty>({
    queryKey: ["poidh-bounty", chainId, id],
    queryFn: async () => {
      const res = await fetch(`/api/poidh/bounties/${chainId}/${id}`);
      if (!res.ok) throw new Error("Failed to fetch bounty");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ethPrice } = useQuery<number>({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      if (!res.ok) return 2500;
      const data = await res.json();
      return data?.ethereum?.usd ?? 2500;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimTitle, setClaimTitle] = useState("");
  const [claimDescription, setClaimDescription] = useState("");
  const [claimUri, setClaimUri] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isDragOverProof, setIsDragOverProof] = useState(false);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Wallet & write hooks
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const poidh = usePoidhWrite();

  // Hive cross-post hooks
  const { hiveUser } = useHiveUser();
  const { identity: userbaseHiveIdentity } = useUserbaseHiveIdentity();
  const { aioha, user: aiohaUser } = useAioha();

  const detailHref = `/bounties/poidh/${chainId}/${id}`;
  const numericChainId = parseInt(chainId, 10);
  const chainLabel = CHAIN_LABEL[numericChainId] ?? "Unknown";

  // Upload handlers
  const handleProofImageUpload = async (compressedUrl: string | null, fileName?: string) => {
    if (!compressedUrl) return;
    setIsUploadingProof(true);
    try {
      const blob = await fetch(compressedUrl).then((r) => r.blob());
      const result = await uploadToIpfsSmart(blob, { fileName: fileName || "proof.jpg" });
      if (result?.url) {
        setClaimUri(result.url);
        const imageMarkdown = `![proof](${result.url})`;
        setClaimDescription((prev) => (prev ? `${prev}\n\n${imageMarkdown}` : imageMarkdown));
      }
    } catch (e) {
      console.error("Image upload failed:", e);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleProofVideoFile = async (file: File) => {
    setIsUploadingProof(true);
    try {
      const result = await uploadToIpfsSmart(file, { fileName: file.name, creator: "bounty-claim" });
      if (result?.url) {
        setClaimUri(result.url);
        const videoMarkdown = generateVideoIframeMarkdown(result.url, "Bounty proof");
        setClaimDescription((prev) => (prev ? `${prev}\n\n${videoMarkdown}` : videoMarkdown));
      }
    } catch (e) {
      console.error("Video upload failed:", e);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleProofDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverProof(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        setIsUploadingProof(true);
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true,
          });
          const url = URL.createObjectURL(compressed);
          await handleProofImageUpload(url, compressed.name);
          URL.revokeObjectURL(url);
        } catch { /* ignore */ } finally {
          setIsUploadingProof(false);
        }
      } else if (file.type.startsWith("video/")) {
        await handleProofVideoFile(file);
      }
    }
  };

  const handleFileClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        setIsUploadingProof(true);
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true,
          });
          const url = URL.createObjectURL(compressed);
          await handleProofImageUpload(url, compressed.name);
          URL.revokeObjectURL(url);
        } catch { /* ignore */ } finally { setIsUploadingProof(false); }
      } else if (file.type.startsWith("video/")) {
        await handleProofVideoFile(file);
      }
    };
    input.click();
  };

  const handleSubmitClaim = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    if (!bounty) return;
    const onChainBountyId = BigInt(bounty.onChainId);
    if (!claimTitle.trim()) return;

    try {
      let finalDescription = claimDescription;
      if (claimUri && !claimDescription.includes(claimUri)) {
        const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(claimUri) || claimUri.includes("video");
        const mediaMarkdown = isVideo
          ? generateVideoIframeMarkdown(claimUri, claimTitle || "Bounty proof")
          : `![proof](${claimUri})`;
        finalDescription = finalDescription ? `${finalDescription}\n\n${mediaMarkdown}` : mediaMarkdown;
      }

      await poidh.createClaim(numericChainId, onChainBountyId, claimTitle, finalDescription, claimUri);

      // Cross-post to Hive if user has Hive identity
      const hasHive = !!(hiveUser || userbaseHiveIdentity?.handle);
      const amountInEth = safeFormatEther(bounty.amount);
      const poidhUrl = `https://poidh.xyz/${CHAIN_PATH[numericChainId]}/bounty/${bounty.id}`;
      const claimPageUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/bounties/poidh/${chainId}/${id}`;

      if (hasHive) {
        try {
          const hiveTitle = `POIDH Bounty Claim: ${claimTitle}`;
          const permlink = generatePermlink(`poidh-claim-${bounty.id}-${Date.now()}`);
          const hiveBody = [
            `## ${claimTitle}`,
            "",
            finalDescription || "",
            "",
            claimUri ? (
              /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(claimUri) || claimUri.includes("video")
                ? generateVideoIframeMarkdown(claimUri, claimTitle)
                : `![proof](${claimUri})`
            ) : "",
            "",
            `---`,
            `*Bounty claim submitted on [POIDH](${poidhUrl}) (${chainLabel}) for ${amountInEth} ETH*`,
            `*View on [Skatehive](${claimPageUrl})*`,
          ].filter(Boolean).join("\n");

          const imageArray = claimUri && !/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(claimUri)
            ? [claimUri] : [];

          if (aiohaUser) {
            await aioha.comment(
              null, HIVE_CONFIG.COMMUNITY_TAG, permlink, hiveTitle, hiveBody,
              { tags: ["skatehive", "poidh", "bounty"], app: "Skatehive App 3.0", image: imageArray }
            );
          } else {
            await fetch("/api/userbase/hive/comment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parent_author: "", parent_permlink: HIVE_CONFIG.COMMUNITY_TAG,
                permlink, title: hiveTitle, body: hiveBody,
                json_metadata: { tags: ["skatehive", "poidh", "bounty"], app: "Skatehive App 3.0", image: imageArray },
                beneficiaries: [], type: "post",
              }),
            });
          }
          toast({ title: "Also posted to Hive!", status: "success", duration: 3000 });
        } catch (e) {
          console.error("Hive cross-post failed:", e);
        }
      }

      // Reset form & close modal
      setShowClaimModal(false);
      setClaimTitle("");
      setClaimDescription("");
      setClaimUri("");
      // Refresh bounty data
      queryClient.invalidateQueries({ queryKey: ["poidh-bounty", chainId, id] });
      toast({ title: "Claim submitted!", status: "success", duration: 3000 });
    } catch { /* handled by hook */ }
  };

  const isBusy = poidh.status === "switching-chain" || poidh.status === "pending-approval" || poidh.status === "pending-tx";

  if (isLoading) {
    return (
      <Box border="1px" borderColor="gray.600" borderRadius="none" p={3} my={4}>
        <VStack align="start" spacing={2}>
          <Skeleton height="16px" width="60%" />
          <Skeleton height="14px" width="40%" />
        </VStack>
      </Box>
    );
  }

  if (!bounty) return null;

  const amountInEth = safeFormatEther(bounty.amount);
  const amountFloat = parseFloat(amountInEth);
  const claimCount = bounty.claims?.length ?? bounty.claimCount ?? 0;
  const desc = bounty.description ? cleanDescription(bounty.description) : "";
  const usdValue = ethPrice ? (amountFloat * ethPrice).toFixed(2) : null;
  const ethDisplay = amountFloat < 0.001 ? amountFloat.toFixed(6) : amountFloat.toFixed(4);
  const isActive = bounty.isActive ?? !bounty.claimer;

  return (
    <>
      <Box
        as={NextLink}
        href={detailHref}
        display="block"
        border="1px"
        borderColor="gray.600"
        borderRadius="none"
        p={4}
        my={4}
        overflow="hidden"
        wordBreak="break-word"
        _hover={{ borderColor: "primary", bg: "rgba(167,255,0,0.02)" }}
        transition="all 0.15s"
        cursor="pointer"
      >
        <VStack align="start" spacing={3} width="full">
          {/* Header */}
          <HStack justify="space-between" width="full">
            <Text fontWeight="bold" fontSize="sm" fontFamily="mono" color="primary">
              POIDH BOUNTY 💰
            </Text>
            <HStack spacing={1.5} align="center">
              <Icon as={FaEthereum} boxSize="12px" color="#627EEA" mt="-1px" />
              <Text fontSize="xs" fontFamily="mono" color="gray.500">
                {chainLabel}
              </Text>
            </HStack>
          </HStack>

          {/* Image — natural aspect ratio */}
          {bounty.imageUrl && (
            <Image
              src={bounty.imageUrl}
              alt={bounty.name}
              width="100%"
              height="auto"
              objectFit="contain"
              bg="black"
            />
          )}

          {/* Title */}
          <Text fontWeight="bold" fontSize="md" noOfLines={2}>
            {bounty.name}
          </Text>

          {/* Description */}
          {desc && (
            <Text fontSize="sm" color="gray.400" noOfLines={2}>
              {desc}
            </Text>
          )}

          <Divider borderColor="gray.700" />

          {/* Reward + claims + claim button */}
          <HStack justify="space-between" width="full" align="center">
            <HStack spacing={2} align="center">
              <Icon as={FaEthereum} boxSize="18px" color="#627EEA" flexShrink={0} />
              <Text fontWeight="900" fontSize="lg" fontFamily="mono" color="#627EEA">
                {ethDisplay} ETH
              </Text>
              {usdValue && (
                <>
                  <Text fontWeight="900" fontSize="lg" color="gray.500" fontFamily="mono">
                    ~
                  </Text>
                  <Text fontWeight="900" fontSize="lg" color="primary" fontFamily="mono">
                    ${usdValue}
                  </Text>
                </>
              )}
            </HStack>
            <HStack spacing={3}>
              <Text fontSize="xs" fontFamily="mono" color="gray.500">
                {claimCount} {claimCount === 1 ? "claim" : "claims"}
              </Text>
              {isActive && (
                <Button
                  size="xs"
                  bg="primary"
                  color="background"
                  borderRadius="none"
                  fontFamily="mono"
                  fontWeight="bold"
                  fontSize="xs"
                  textTransform="uppercase"
                  leftIcon={<Icon as={FaBolt} boxSize="10px" />}
                  _hover={{ bg: "accent" }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowClaimModal(true);
                  }}
                >
                  CLAIM
                </Button>
              )}
            </HStack>
          </HStack>
        </VStack>
      </Box>

      {/* Claim Modal */}
      <SkateModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        title={`Claim Bounty: ${bounty.name}`}
        size="lg"
      >
        <Box p={4}>
          <VStack spacing={4} align="stretch">
            {/* Bounty info summary */}
            <HStack spacing={2} pb={3} borderBottom="1px solid" borderColor="border">
              <Icon as={FaEthereum} boxSize="16px" color="#627EEA" />
              <Text fontWeight="900" fontSize="md" fontFamily="mono" color="#627EEA">
                {ethDisplay} ETH
              </Text>
              {usdValue && (
                <>
                  <Text color="gray.500" fontFamily="mono">~</Text>
                  <Text fontWeight="900" fontSize="md" fontFamily="mono" color="primary">
                    ${usdValue}
                  </Text>
                </>
              )}
              <Text fontSize="xs" fontFamily="mono" color="gray.500" ml="auto">
                {chainLabel}
              </Text>
            </HStack>

            {/* Claim form */}
            <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="text" textTransform="uppercase">
              SUBMIT YOUR PROOF
            </Text>

            <Input
              value={claimTitle}
              onChange={(e) => setClaimTitle(e.target.value)}
              placeholder="Claim title"
              bg="background"
              border="1px solid"
              borderColor="border"
              borderRadius="none"
              fontFamily="mono"
              fontSize="sm"
              color="text"
              _placeholder={{ color: "dim" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />

            <Textarea
              value={claimDescription}
              onChange={(e) => setClaimDescription(e.target.value)}
              placeholder="Describe your proof..."
              bg="background"
              border="1px solid"
              borderColor="border"
              borderRadius="none"
              fontFamily="mono"
              fontSize="sm"
              color="text"
              rows={3}
              _placeholder={{ color: "dim" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />

            {/* Upload zone */}
            {claimUri ? (
              <Box position="relative" border="1px solid" borderColor="primary" bg="background" p={2}>
                <MediaPreview src={claimUri} />
                <Button
                  position="absolute"
                  top={1}
                  right={1}
                  size="xs"
                  bg="rgba(0,0,0,0.7)"
                  color="error"
                  borderRadius="none"
                  onClick={() => setClaimUri("")}
                  _hover={{ bg: "rgba(0,0,0,0.9)" }}
                >
                  <Icon as={FaTimes} />
                </Button>
              </Box>
            ) : (
              <Box
                border="2px dashed"
                borderColor={isDragOverProof ? "primary" : "border"}
                bg={isDragOverProof ? "rgba(167,255,0,0.05)" : "background"}
                p={4}
                textAlign="center"
                cursor="pointer"
                transition="all 0.2s"
                onDragOver={(e) => { e.preventDefault(); setIsDragOverProof(true); }}
                onDragLeave={() => setIsDragOverProof(false)}
                onDrop={handleProofDrop}
                onClick={handleFileClick}
              >
                {isUploadingProof ? (
                  <VStack spacing={1}>
                    <Spinner size="sm" color="primary" />
                    <Text fontSize="xs" fontFamily="mono" color="primary">UPLOADING...</Text>
                  </VStack>
                ) : (
                  <VStack spacing={1}>
                    <Text fontSize="sm" fontFamily="mono" color="dim">
                      DROP IMAGE/VIDEO OR CLICK TO UPLOAD
                    </Text>
                    <Text fontSize="2xs" fontFamily="mono" color="dim" opacity={0.5}>
                      Auto-uploads to IPFS
                    </Text>
                  </VStack>
                )}
              </Box>
            )}

            <Input
              value={claimUri}
              onChange={(e) => setClaimUri(e.target.value)}
              placeholder="Or paste URL (image/video link or IPFS URI)"
              bg="background"
              border="1px solid"
              borderColor="border"
              borderRadius="none"
              fontFamily="mono"
              fontSize="xs"
              color="text"
              _placeholder={{ color: "dim" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />

            {/* Hidden image compressor */}
            <Box display="none">
              <ImageCompressor ref={imageCompressorRef} onUpload={handleProofImageUpload} />
            </Box>

            {/* Submit / Cancel */}
            <Flex gap={2} direction={{ base: "column", sm: "row" }}>
              <Button
                onClick={handleSubmitClaim}
                isLoading={isBusy}
                flex={1}
                bg="primary"
                color="background"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="bold"
                fontSize="xs"
                textTransform="uppercase"
                _hover={{ bg: "accent" }}
                isDisabled={!claimTitle.trim()}
              >
                SUBMIT CLAIM
              </Button>
              <Button
                onClick={() => setShowClaimModal(false)}
                variant="ghost"
                borderRadius="none"
                fontFamily="mono"
                fontSize="xs"
                color="dim"
              >
                CANCEL
              </Button>
            </Flex>
          </VStack>
        </Box>
      </SkateModal>
    </>
  );
}
