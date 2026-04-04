"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n/hooks";
import VirtualCastsView from "./VirtualCastsView";
import {
  Box,
  VStack,
  HStack,
  Text,
  Image,
  Link,
  Spinner,
  Center,
  Avatar,
  Icon,
  Flex,
  Button,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import {
  FaHeart,
  FaRetweet,
  FaExternalLinkAlt,
  FaRegHeart,
  FaRegComment,
} from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import { useFarcasterSigner } from "@/hooks/useFarcasterSigner";
import { useProfileDebug } from "@/lib/utils/profileDebug";

interface FarcasterCast {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  embeds?: Array<{
    url?: string;
    metadata?: {
      image?: { url: string };
      html?: { ogImage?: Array<{ url: string }> };
      _status?: string;
    };
  }>;
  reactions?: {
    likes_count: number;
    recasts_count: number;
  };
  replies?: {
    count: number;
  };
  thread_hash?: string;
  parent_hash?: string | null;
}

interface FarcasterCastsViewProps {
  fid: number;
  username?: string;
}

// ─── Time formatting ─────────────────────────────────────

function formatCastTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ─── Single Cast ─────────────────────────────────────────

interface CastItemProps {
  cast: FarcasterCast;
  onNeedSigner: () => void;
  signerApproved: boolean;
}

function CastItem({ cast, onNeedSigner, signerApproved }: CastItemProps) {
  const [likeCount, setLikeCount] = useState(cast.reactions?.likes_count || 0);
  const [recastCount, setRecastCount] = useState(cast.reactions?.recasts_count || 0);
  const [replyCount, setReplyCount] = useState(cast.replies?.count || 0);
  const [liked, setLiked] = useState(false);
  const [recasted, setRecasted] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const warpcastUrl = `https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 10)}`;

  // Extract images from embeds
  const images: string[] = [];
  const links: { url: string; label: string }[] = [];

  if (cast.embeds) {
    for (const embed of cast.embeds) {
      const imgUrl = embed.metadata?.image?.url
        || embed.metadata?.html?.ogImage?.[0]?.url;
      const rawUrl = embed.url || "";

      if (imgUrl) {
        images.push(imgUrl);
      } else if (
        rawUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) ||
        rawUrl.includes("imagedelivery.net") ||
        rawUrl.includes("i.imgur.com") ||
        rawUrl.includes("res.cloudinary.com")
      ) {
        images.push(rawUrl);
      } else if (rawUrl && !rawUrl.includes("warpcast.com")) {
        try {
          const u = new URL(rawUrl);
          links.push({ url: rawUrl, label: `${u.hostname}${u.pathname.length > 1 ? u.pathname.slice(0, 30) : ""}` });
        } catch {
          links.push({ url: rawUrl, label: rawUrl.slice(0, 40) });
        }
      }
    }
  }

  const renderText = (text: string) => {
    const parts = text.split(/(https?:\/\/\S+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("http")) {
        return (
          <Link key={i} href={part} isExternal color="primary" wordBreak="break-all"
            _hover={{ textDecoration: "underline" }}>
            {part.length > 50 ? part.slice(0, 50) + "..." : part}
          </Link>
        );
      }
      if (part.startsWith("@")) {
        return (
          <Link key={i} href={`https://warpcast.com/${part.slice(1)}`} isExternal
            color="primary" _hover={{ textDecoration: "underline" }}>
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleReaction = async (type: "like" | "recast") => {
    if (!signerApproved) {
      onNeedSigner();
      return;
    }
    if (actionLoading) return;

    const isUndo = type === "like" ? liked : recasted;
    const method = isUndo ? "DELETE" : "POST";

    // Optimistic update
    if (type === "like") {
      setLiked(!liked);
      setLikeCount((c) => c + (isUndo ? -1 : 1));
    } else {
      setRecasted(!recasted);
      setRecastCount((c) => c + (isUndo ? -1 : 1));
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/farcaster/reaction", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: type, targetHash: cast.hash }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.needsSigner) {
          onNeedSigner();
        }
        // Revert optimistic update
        if (type === "like") {
          setLiked(isUndo ? true : false);
          setLikeCount((c) => c + (isUndo ? 1 : -1));
        } else {
          setRecasted(isUndo ? true : false);
          setRecastCount((c) => c + (isUndo ? 1 : -1));
        }
      }
    } catch {
      // Revert on error
      if (type === "like") {
        setLiked(isUndo ? true : false);
        setLikeCount((c) => c + (isUndo ? 1 : -1));
      } else {
        setRecasted(isUndo ? true : false);
        setRecastCount((c) => c + (isUndo ? 1 : -1));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReply = async () => {
    if (!signerApproved) {
      onNeedSigner();
      return;
    }
    if (!replyText.trim() || replyLoading) return;

    setReplyLoading(true);
    try {
      const res = await fetch("/api/farcaster/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim(), parentHash: cast.hash }),
      });

      if (res.ok) {
        setReplyText("");
        setShowReply(false);
        setReplyCount((c) => c + 1);
      } else {
        const data = await res.json();
        if (data.needsSigner) onNeedSigner();
      }
    } catch {
      // silently fail
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!signerApproved) {
      onNeedSigner();
      return;
    }
    setShowReply(!showReply);
  };

  return (
    <Box>
      <Box
        onClick={() => window.open(warpcastUrl, "_blank", "noopener,noreferrer")}
        cursor="pointer"
      >
        <HStack
          align="start"
          spacing={3}
          px={4}
          py={3}
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
          _hover={{ bg: "whiteAlpha.50" }}
          transition="background 0.15s"
        >
          {/* Avatar */}
          <Link href={`https://warpcast.com/${cast.author.username}`} isExternal
            onClick={(e) => e.stopPropagation()} flexShrink={0}>
            <Avatar
              src={cast.author.pfp_url}
              name={cast.author.display_name}
              size="md"
              borderRadius="full"
            />
          </Link>

          {/* Content */}
          <Box flex={1} minW={0}>
            {/* Header */}
            <HStack spacing={1} mb={0.5} flexWrap="wrap">
              <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" noOfLines={1}>
                {cast.author.display_name}
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="gray.500">
                @{cast.author.username}
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="gray.600">·</Text>
              <Text fontFamily="mono" fontSize="xs" color="gray.500">
                {formatCastTime(cast.timestamp)}
              </Text>
            </HStack>

            {/* Body */}
            {cast.text && (
              <Text fontFamily="mono" fontSize="sm" color="text" whiteSpace="pre-wrap"
                lineHeight="1.5" mb={2} wordBreak="break-word">
                {renderText(cast.text)}
              </Text>
            )}

            {/* Images */}
            {images.length > 0 && (
              <Box mb={2} borderRadius="md" overflow="hidden" border="1px solid" borderColor="whiteAlpha.100"
                onClick={(e) => e.stopPropagation()}>
                {images.length === 1 ? (
                  <Image src={images[0]} alt="" maxH="350px" w="100%" objectFit="cover"
                    fallback={<Box h="100px" bg="whiteAlpha.50" />} />
                ) : (
                  <Flex gap={0.5} flexWrap="wrap">
                    {images.slice(0, 4).map((img, i) => (
                      <Image key={i} src={img} alt="" h="180px" flex="1 1 45%" minW="45%"
                        objectFit="cover" fallback={<Box h="180px" flex="1 1 45%" bg="whiteAlpha.50" />} />
                    ))}
                  </Flex>
                )}
              </Box>
            )}

            {/* Link previews */}
            {links.length > 0 && (
              <VStack spacing={1} align="stretch" mb={2}>
                {links.map((link, i) => (
                  <Link key={i} href={link.url} isExternal onClick={(e) => e.stopPropagation()}
                    _hover={{ textDecoration: "none" }}>
                    <HStack spacing={2} px={3} py={2} border="1px solid" borderColor="whiteAlpha.100"
                      borderRadius="md" _hover={{ borderColor: "primary", bg: "whiteAlpha.50" }}
                      transition="all 0.15s">
                      <Icon as={FaExternalLinkAlt} boxSize={3} color="gray.500" />
                      <Text fontFamily="mono" fontSize="2xs" color="gray.400" noOfLines={1}>
                        {link.label}
                      </Text>
                    </HStack>
                  </Link>
                ))}
              </VStack>
            )}

            {/* Action bar */}
            <HStack spacing={6} mt={1}>
              <HStack
                as="button"
                spacing={1.5}
                color="gray.500"
                _hover={{ color: "blue.400" }}
                transition="color 0.15s"
                onClick={handleCommentClick}
              >
                <Icon as={FaRegComment} boxSize={3.5} />
                {replyCount > 0 && <Text fontFamily="mono" fontSize="2xs">{replyCount}</Text>}
              </HStack>
              <HStack
                as="button"
                spacing={1.5}
                color={recasted ? "green.400" : "gray.500"}
                _hover={{ color: "green.400" }}
                transition="color 0.15s"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction("recast"); }}
              >
                <Icon as={FaRetweet} boxSize={3.5} />
                {recastCount > 0 && <Text fontFamily="mono" fontSize="2xs">{recastCount}</Text>}
              </HStack>
              <HStack
                as="button"
                spacing={1.5}
                color={liked ? "red.400" : "gray.500"}
                _hover={{ color: "red.400" }}
                transition="color 0.15s"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction("like"); }}
              >
                <Icon as={liked ? FaHeart : FaRegHeart} boxSize={3.5} />
                {likeCount > 0 && <Text fontFamily="mono" fontSize="2xs">{likeCount}</Text>}
              </HStack>
              <Link href={warpcastUrl} isExternal onClick={(e) => e.stopPropagation()} ml="auto"
                _hover={{ textDecoration: "none" }}>
                <Icon as={SiFarcaster} boxSize={3} color="gray.600" _hover={{ color: "primary" }}
                  transition="color 0.15s" />
              </Link>
            </HStack>
          </Box>
        </HStack>
      </Box>

      {/* Reply input */}
      {showReply && (
        <HStack px={4} py={2} pl={16} spacing={2} borderBottom="1px solid" borderColor="whiteAlpha.100"
          bg="whiteAlpha.50">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply..."
            size="sm"
            fontFamily="mono"
            fontSize="xs"
            bg="transparent"
            border="1px solid"
            borderColor="whiteAlpha.200"
            color="text"
            _focus={{ borderColor: "primary" }}
            _placeholder={{ color: "gray.600" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
            maxLength={1024}
          />
          <Button
            size="sm"
            fontFamily="mono"
            fontSize="2xs"
            bg="primary"
            color="background"
            onClick={handleReply}
            isLoading={replyLoading}
            isDisabled={!replyText.trim()}
            _hover={{ opacity: 0.8 }}
          >
            Reply
          </Button>
        </HStack>
      )}
    </Box>
  );
}

// ─── QR Code for Signer Approval ────────────────────────────

function ApprovalQrView({ approvalUrl }: { approvalUrl: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(approvalUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => { cancelled = true; };
  }, [approvalUrl]);

  return (
    <VStack spacing={3}>
      <Text fontFamily="mono" fontSize="xs" color="text" textAlign="center">
        Scan with your phone to approve in the Farcaster app.
      </Text>
      {qrDataUrl ? (
        <Box borderRadius="md" overflow="hidden" bg="white" p={2}>
          <Image src={qrDataUrl} alt="Scan to approve" w="200px" h="200px" />
        </Box>
      ) : (
        <Spinner size="md" color="primary" />
      )}
      <HStack spacing={2}>
        <Spinner size="xs" color="primary" />
        <Text fontFamily="mono" fontSize="2xs" color="gray.500">
          Waiting for approval...
        </Text>
      </HStack>
      <Button
        as="a"
        href={approvalUrl}
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
        variant="ghost"
        fontFamily="mono"
        fontSize="2xs"
        color="gray.600"
        _hover={{ color: "primary" }}
      >
        or open link directly
      </Button>
    </VStack>
  );
}

// ─── Signer Approval Modal ─────────────────────────────────

function SignerModal({
  isOpen,
  onClose,
  approvalUrl,
  isPending,
  isLoading,
  error,
  onCreateSigner,
}: {
  isOpen: boolean;
  onClose: () => void;
  approvalUrl: string | null;
  isPending: boolean;
  isLoading: boolean;
  error: string | null;
  onCreateSigner: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="background" border="1px solid" borderColor="primary" borderRadius="md">
        <ModalHeader fontFamily="mono" fontSize="sm" color="primary" borderBottom="1px solid"
          borderColor="whiteAlpha.100">
          <HStack spacing={2}>
            <Icon as={SiFarcaster} />
            <Text>Authorize Reactions</Text>
          </HStack>
        </ModalHeader>
        <ModalBody py={4}>
          {error ? (
            <VStack spacing={3}>
              <Text fontFamily="mono" fontSize="xs" color="red.400" textAlign="center">
                {error === "Unauthorized"
                  ? "You need to log in first to interact with casts."
                  : error === "No Farcaster identity linked"
                  ? "Link your Farcaster account in Settings first."
                  : error}
              </Text>
              <Button
                size="sm"
                fontFamily="mono"
                fontSize="xs"
                variant="outline"
                borderColor="primary"
                color="primary"
                _hover={{ bg: "whiteAlpha.100" }}
                w="full"
                onClick={onCreateSigner}
              >
                Try Again
              </Button>
            </VStack>
          ) : isPending && approvalUrl ? (
            <ApprovalQrView approvalUrl={approvalUrl} />
          ) : isLoading ? (
            <Center py={4}>
              <VStack spacing={2}>
                <Spinner size="md" color="primary" />
                <Text fontFamily="mono" fontSize="2xs" color="gray.500">Creating signer...</Text>
              </VStack>
            </Center>
          ) : (
            <VStack spacing={3}>
              <Text fontFamily="mono" fontSize="xs" color="text" textAlign="center">
                One-time authorization to like, recast, and reply on Farcaster from Skatehive.
              </Text>
              <Button
                size="sm"
                fontFamily="mono"
                fontSize="xs"
                bg="primary"
                color="background"
                _hover={{ opacity: 0.8 }}
                w="full"
                onClick={onCreateSigner}
              >
                Authorize in Farcaster
              </Button>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="whiteAlpha.100" py={2}>
          <Button size="xs" variant="ghost" fontFamily="mono" fontSize="2xs" color="gray.500"
            onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function FarcasterCastsView({ fid, username }: FarcasterCastsViewProps) {
  useProfileDebug("FarcasterCastsView");
  const t = useTranslations("profile");
  const [casts, setCasts] = useState<FarcasterCast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const signer = useFarcasterSigner();

  const fetchCasts = useCallback(async () => {
    if (!fid || fid === 0) {
      setIsLoading(false);
      setError("No Farcaster profile found");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/farcaster/casts?fid=${fid}&limit=${limit}`);
      if (!response.ok) throw new Error(`Failed to fetch casts: ${response.statusText}`);
      const data = await response.json();
      setCasts(data.casts || []);
    } catch (err) {
      console.error("Error fetching Farcaster casts:", err);
      setError(err instanceof Error ? err.message : "Failed to load casts");
    } finally {
      setIsLoading(false);
    }
  }, [fid, limit]);

  useEffect(() => { fetchCasts(); }, [fetchCasts]);

  // Auto-close modal when signer gets approved
  useEffect(() => {
    if (signer.isApproved && isOpen) onClose();
  }, [signer.isApproved, isOpen, onClose]);

  const handleNeedSigner = () => {
    if (signer.isApproved) return; // Already approved
    if (signer.status === "none" || signer.status === "error") {
      signer.checkOrCreateSigner();
    }
    onOpen();
  };

  if (isLoading) {
    return (
      <Center minH="300px">
        <VStack spacing={3}>
          <Spinner size="lg" color="primary" />
          <Text color="gray.500" fontFamily="mono" fontSize="xs">{t("loadingCasts")}</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center minH="200px">
        <Text color="gray.500" fontFamily="mono" fontSize="xs">{error}</Text>
      </Center>
    );
  }

  if (casts.length === 0) {
    return (
      <Center minH="200px">
        <VStack spacing={2}>
          <Icon as={SiFarcaster} boxSize={6} color="gray.600" />
          <Text color="gray.500" fontFamily="mono" fontSize="xs">{t("noCastsFound")}</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <>
      <VirtualCastsView
        casts={casts}
        renderCast={(cast) => (
          <CastItem
            key={cast.hash}
            cast={cast}
            onNeedSigner={handleNeedSigner}
            signerApproved={signer.isApproved}
          />
        )}
        onLoadMore={() => setLimit((l) => l + 15)}
        hasMore={casts.length >= limit}
        isLoadingMore={false}
      />

      <SignerModal
        isOpen={isOpen}
        onClose={onClose}
        approvalUrl={signer.approvalUrl}
        isPending={signer.isPending}
        isLoading={signer.isLoading}
        error={signer.error}
        onCreateSigner={signer.checkOrCreateSigner}
      />
    </>
  );
}
