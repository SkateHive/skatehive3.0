'use client';

import { useState, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Textarea,
  Input,
  IconButton,
  Wrap,
  Image,
} from '@chakra-ui/react';
import { FaEthereum, FaImage, FaVideo, FaTimes } from 'react-icons/fa';
import { useAccount, usePublicClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { usePoidhWrite } from '@/hooks/usePoidhWrite';
import { CHAIN_LABEL } from '@/lib/poidh-constants';
import { POIDH_ABI, POIDH_CONTRACT_ADDRESS } from '@/lib/poidh-abi';
import ImageCompressor, { ImageCompressorRef } from '@/lib/utils/ImageCompressor';
import VideoUploader, { VideoUploaderRef } from '@/components/homepage/VideoUploader';
import { uploadToIpfs } from '@/lib/markdown/composeUtils';
import imageCompression from 'browser-image-compression';

interface PoidhBountyComposerProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const SUPPORTED_CHAINS = [
  { id: 8453, label: 'BASE', color: '#627EEA' },
  { id: 42161, label: 'ARBITRUM', color: '#28A0F0' },
];

export default function PoidhBountyComposer({ onSuccess, onClose }: PoidhBountyComposerProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const poidh = usePoidhWrite();
  const publicClient = usePublicClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [chainId, setChainId] = useState(8453);

  // Media state
  const [compressedImages, setCompressedImages] = useState<{ url: string; fileName: string }[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);

  const isValid = title.trim().length > 0 && parseFloat(amount) >= 0.001;
  const isBusy = poidh.status === 'switching-chain' || poidh.status === 'pending-approval' || poidh.status === 'pending-tx';

  // Build description with media markdown for on-chain storage
  const buildDescription = () => {
    let body = `[skatehive] ${description}`;
    if (compressedImages.length > 0) {
      const imageMarkup = compressedImages
        .map((img) => `\nThumbnail: ![](${img.url})`)
        .join('');
      body += imageMarkup;
    }
    if (videoUrl) {
      body += `\nVideo: ${videoUrl}`;
    }
    body += `\n\nView on Skatehive: https://skatehive.app/bounties`;
    return body;
  };

  const handleSubmit = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (!isValid) return;

    try {
      const taggedDescription = buildDescription();
      await poidh.createOpenBounty(chainId, title, taggedDescription, amount);

      // Read bountyCounter to get the on-chain ID of the new bounty, then announce
      if (address) {
        (async () => {
          try {
            let bountyOnChainId: number | undefined;
            if (publicClient) {
              const counter = await publicClient.readContract({
                address: POIDH_CONTRACT_ADDRESS,
                abi: POIDH_ABI,
                functionName: 'bountyCounter',
              }) as bigint;
              // Counter was incremented after creation, so new bounty = counter - 1
              bountyOnChainId = Number(counter) - 1;
            }
            await fetch('/api/poidh/announce', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title,
                amount,
                chainId,
                issuerAddress: address,
                bountyOnChainId,
              }),
            });
          } catch { /* announcement failure is non-critical */ }
        })();
      }

      onSuccess?.();
    } catch {
      // error is handled by the hook
    }
  };

  // Image upload via IPFS (no Hive auth needed)
  const handleCompressedImageUpload = async (url: string | null, fileName?: string) => {
    if (!url) return;
    setIsUploading(true);
    try {
      const blob = await fetch(url).then((res) => res.blob());
      const ipfsUrl = await uploadToIpfs(blob, fileName || 'bounty-image.jpg');
      setCompressedImages((prev) => [...prev, { url: ipfsUrl, fileName: fileName || 'image' }]);
    } catch {
      // silently fail
    } finally {
      setIsUploading(false);
    }
  };

  // Video upload handler
  const handleVideoUpload = (result: { url?: string; hash?: string } | null) => {
    if (result?.url) {
      setVideoUrl(result.url);
    }
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        setIsUploading(true);
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const url = URL.createObjectURL(compressed);
          await handleCompressedImageUpload(url, compressed.name);
          URL.revokeObjectURL(url);
        } catch { /* ignore */ } finally {
          setIsUploading(false);
        }
      } else if (file.type.startsWith('video/')) {
        if (videoUploaderRef.current?.handleFile) {
          setIsUploading(true);
          try {
            await videoUploaderRef.current.handleFile(file);
          } catch { /* ignore */ } finally {
            setIsUploading(false);
          }
        }
      }
    }
  };

  const statusLabel = (() => {
    switch (poidh.status) {
      case 'switching-chain': return `SWITCHING TO ${CHAIN_LABEL[chainId]?.toUpperCase()}...`;
      case 'pending-approval': return 'CONFIRM IN WALLET...';
      case 'pending-tx': return 'WAITING FOR CONFIRMATION...';
      case 'confirmed': return 'BOUNTY CREATED!';
      case 'error': return poidh.error || 'TRANSACTION FAILED';
      default: return null;
    }
  })();

  if (poidh.status === 'confirmed') {
    return (
      <VStack spacing={4} py={6} px={4}>
        <Box border="1px solid" borderColor="success" px={6} py={4} w="100%">
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="900" fontFamily="mono" color="success">
              BOUNTY CREATED!
            </Text>
            <Text fontSize="xs" fontFamily="mono" color="dim" textAlign="center">
              YOUR BOUNTY IS NOW LIVE ON {CHAIN_LABEL[chainId]?.toUpperCase()}.
              IT WILL APPEAR IN THE FEED SHORTLY.
            </Text>
          </VStack>
        </Box>
        <Button
          onClick={onClose}
          bg="primary"
          color="background"
          borderRadius="none"
          fontFamily="mono"
          fontWeight="bold"
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wider"
          w="100%"
          _hover={{ bg: 'accent' }}
        >
          CLOSE
        </Button>
      </VStack>
    );
  }

  return (
    <VStack
      spacing={4}
      py={4}
      px={2}
      align="stretch"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      border={isDragOver ? '2px dashed' : undefined}
      borderColor={isDragOver ? 'primary' : undefined}
      transition="border 0.2s"
    >
      {/* Chain selector */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          CHAIN
        </Text>
        <HStack spacing={2}>
          {SUPPORTED_CHAINS.map((c) => (
            <Box
              key={c.id}
              as="button"
              flex={1}
              border="2px solid"
              borderColor={chainId === c.id ? c.color : 'border'}
              bg={chainId === c.id ? `${c.color}15` : 'transparent'}
              px={3}
              py={2}
              cursor="pointer"
              onClick={() => setChainId(c.id)}
              transition="all 0.15s"
            >
              <HStack spacing={2} justify="center">
                <Icon as={FaEthereum} boxSize="14px" color={c.color} />
                <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color={chainId === c.id ? 'text' : 'dim'}>
                  {c.label}
                </Text>
              </HStack>
            </Box>
          ))}
        </HStack>
      </Box>

      {/* Title */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          BOUNTY TITLE
        </Text>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best Kickflip Down 5 Stairs"
          bg="background"
          border="1px solid"
          borderColor="border"
          borderRadius="none"
          fontFamily="mono"
          fontSize="sm"
          color="text"
          _placeholder={{ color: 'dim' }}
          _focus={{ borderColor: 'primary', boxShadow: 'none' }}
        />
      </Box>

      {/* Banner media drop zone — between title and description */}
      <Box>
        {/* Hidden components */}
        <ImageCompressor
          ref={imageCompressorRef}
          onUpload={handleCompressedImageUpload}
          isProcessing={isUploading}
          hideStatus
        />
        <VideoUploader
          ref={videoUploaderRef}
          onUpload={handleVideoUpload}
        />

        {compressedImages.length > 0 ? (
          /* Banner preview — aspect ratio preserved */
          <Box position="relative" w="90%" mx="auto">
            <Image
              src={compressedImages[0].url}
              alt={compressedImages[0].fileName}
              w="100%"
              maxH="200px"
              objectFit="contain"
              border="1px solid"
              borderColor="primary"
            />
            <IconButton
              icon={<FaTimes />}
              size="xs"
              aria-label="Remove image"
              position="absolute"
              top={1}
              right={1}
              bg="rgba(0,0,0,0.7)"
              color="error"
              borderRadius="none"
              _hover={{ bg: 'rgba(0,0,0,0.9)' }}
              onClick={() => setCompressedImages([])}
            />
            {/* Overlay buttons to swap */}
            <HStack position="absolute" bottom={1} left={1} spacing={1}>
              <Button
                size="xs"
                leftIcon={<FaImage />}
                bg="rgba(0,0,0,0.7)"
                color="primary"
                borderRadius="none"
                fontFamily="mono"
                fontSize="2xs"
                _hover={{ bg: 'rgba(0,0,0,0.9)' }}
                isLoading={isUploading}
                onClick={() => imageCompressorRef.current?.trigger()}
              >
                CHANGE
              </Button>
            </HStack>
          </Box>
        ) : videoUrl ? (
          /* Video attached banner */
          <Box
            position="relative"
            w="100%"
            h="160px"
            border="1px solid"
            borderColor="primary"
            bg="rgba(167, 255, 0, 0.03)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <VStack spacing={1}>
              <Icon as={FaVideo} boxSize="24px" color="primary" />
              <Text fontSize="xs" fontFamily="mono" color="primary" fontWeight="bold">
                VIDEO ATTACHED
              </Text>
            </VStack>
            <IconButton
              icon={<FaTimes />}
              size="xs"
              aria-label="Remove video"
              position="absolute"
              top={1}
              right={1}
              bg="rgba(0,0,0,0.7)"
              color="error"
              borderRadius="none"
              _hover={{ bg: 'rgba(0,0,0,0.9)' }}
              onClick={() => setVideoUrl(null)}
            />
          </Box>
        ) : (
          /* Empty drop zone */
          <Box
            w="100%"
            h="120px"
            border={isDragOver ? '2px dashed' : '1px dashed'}
            borderColor={isDragOver ? 'primary' : 'border'}
            bg={isDragOver ? 'rgba(167, 255, 0, 0.05)' : 'transparent'}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.15s"
            _hover={{ borderColor: 'primary', bg: 'rgba(167, 255, 0, 0.03)' }}
            onClick={() => imageCompressorRef.current?.trigger()}
          >
            <VStack spacing={2}>
              {isUploading ? (
                <Text fontSize="xs" fontFamily="mono" color="primary" fontWeight="bold">
                  UPLOADING...
                </Text>
              ) : (
                <>
                  <HStack spacing={3} color="dim">
                    <Icon as={FaImage} boxSize="18px" />
                    <Icon as={FaVideo} boxSize="18px" />
                  </HStack>
                  <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold">
                    {isDragOver ? 'DROP HERE' : 'DROP IMAGE / VIDEO OR CLICK'}
                  </Text>
                </>
              )}
            </VStack>
          </Box>
        )}

      </Box>

      {/* Description */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          DESCRIPTION
        </Text>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you want to see..."
          bg="background"
          border="1px solid"
          borderColor="border"
          borderRadius="none"
          fontFamily="mono"
          fontSize="sm"
          color="text"
          rows={3}
          _placeholder={{ color: 'dim' }}
          _focus={{ borderColor: 'primary', boxShadow: 'none' }}
          resize="vertical"
        />
      </Box>

      {/* Amount */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          REWARD (ETH)
        </Text>
        <HStack spacing={2}>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.01"
            bg="background"
            border="1px solid"
            borderColor="border"
            borderRadius="none"
            fontFamily="mono"
            fontSize="sm"
            color="text"
            _placeholder={{ color: 'dim' }}
            _focus={{ borderColor: 'primary', boxShadow: 'none' }}
          />
          <Box border="1px solid" borderColor="primary" px={3} py={2}>
            <HStack spacing={1}>
              <Icon as={FaEthereum} boxSize="12px" color="#627EEA" />
              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="primary">ETH</Text>
            </HStack>
          </Box>
        </HStack>
        {amount && parseFloat(amount) < 0.001 && (
          <Text fontSize="2xs" fontFamily="mono" color="error" mt={1}>
            MIN: 0.001 ETH
          </Text>
        )}
      </Box>

      {/* Status message */}
      {statusLabel && (
        <Box
          border="1px solid"
          borderColor={poidh.status === 'error' ? 'error' : 'primary'}
          px={3}
          py={2}
        >
          <Text
            fontSize="xs"
            fontFamily="mono"
            fontWeight="bold"
            color={poidh.status === 'error' ? 'error' : 'primary'}
            textAlign="center"
          >
            {statusLabel}
          </Text>
        </Box>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        isLoading={isBusy}
        loadingText={statusLabel || 'PROCESSING...'}
        isDisabled={(isConnected && !isValid) || isUploading}
        bg="primary"
        color="background"
        borderRadius="none"
        fontFamily="mono"
        fontWeight="bold"
        fontSize="sm"
        textTransform="uppercase"
        letterSpacing="wider"
        w="100%"
        _hover={{ bg: 'accent' }}
        _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
      >
        {!isConnected ? 'CONNECT WALLET' : 'CREATE BOUNTY'}
      </Button>

      {/* Info */}
      <Text fontSize="2xs" fontFamily="mono" color="dim" textAlign="center">
        2.5% PROTOCOL FEE ON PAYOUT. BOUNTY IS CREATED ON-CHAIN VIA POIDH.
      </Text>
    </VStack>
  );
}
