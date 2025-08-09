"use client";

import {
  VStack,
  HStack,
  Text,
  Box,
  Button,
  Image,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Badge,
  Divider,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import { uploadToHiveImagesWithRetry } from "@/lib/utils/imageUpload";
import {
  generateAnnouncementContent,
  AirdropAnnouncementParams,
} from "@/services/airdropAnnouncement";
import HiveMarkdown from "@/components/shared/HiveMarkdown";
import useIsMobile from "@/hooks/useIsMobile";
import { SortOption } from "@/types/airdrop";

interface AnnouncementPreviewStepProps {
  selectedToken: string;
  totalAmount: string;
  sortOption: SortOption;
  customMessage: string;
  includeSkateHive: boolean;
  isWeightedAirdrop: boolean;
  isAnonymous: boolean;
  airdropUsers: any[];
  networkScreenshot: string;
  uploadedImageUrl?: string;
  onUploadedImageUrlChange?: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AnnouncementPreviewStep({
  selectedToken,
  totalAmount,
  sortOption,
  customMessage,
  includeSkateHive,
  isWeightedAirdrop,
  isAnonymous,
  airdropUsers,
  networkScreenshot,
  uploadedImageUrl: initialUploadedImageUrl,
  onUploadedImageUrlChange,
  onBack,
  onNext,
}: AnnouncementPreviewStepProps) {
  const isMobile = useIsMobile();
  const { user } = useAioha();
  const { address: ethereumAddress } = useAccount();

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>(
    initialUploadedImageUrl || ""
  );
  const [uploadError, setUploadError] = useState<string>("");
  const [announcementContent, setAnnouncementContent] = useState<string>("");

  // Upload image and generate content on component mount
  useEffect(() => {
    const uploadAndGenerateContent = async () => {
      let imageUrl = "";

      // Upload screenshot if available
      if (networkScreenshot) {
        setIsUploadingImage(true);
        setUploadError("");

        try {
          const uploadResult = await uploadToHiveImagesWithRetry(
            networkScreenshot,
            `airdrop-${selectedToken.toLowerCase()}-${Date.now()}.png`
          );
          imageUrl = uploadResult.url;
          setUploadedImageUrl(imageUrl);
          // Notify parent component of the uploaded URL
          onUploadedImageUrlChange?.(imageUrl);
        } catch (error) {
          console.error("Image upload failed:", error);
          setUploadError(
            error instanceof Error ? error.message : "Image upload failed"
          );
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Generate announcement content
      const params: AirdropAnnouncementParams = {
        token: selectedToken,
        recipients: airdropUsers,
        totalAmount: parseFloat(totalAmount),
        sortOption,
        customMessage,
        isWeighted: isWeightedAirdrop,
        includeSkateHive,
        creator: {
          hiveUsername: user,
          ethereumAddress,
        },
        isAnonymous,
        screenshotDataUrl: networkScreenshot,
      };

      const content = generateAnnouncementContent(params, imageUrl);
      setAnnouncementContent(content);
    };

    uploadAndGenerateContent();
  }, [
    networkScreenshot,
    selectedToken,
    totalAmount,
    sortOption,
    customMessage,
    isWeightedAirdrop,
    includeSkateHive,
    user,
    ethereumAddress,
    isAnonymous,
    airdropUsers,
    onUploadedImageUrlChange, // Added to dependency array
  ]);

  return (
    <>
      <VStack spacing={6} align="stretch">
        {/* Upload Status */}
        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={4} color="primary">
            Network Visualization Upload
          </Text>

          {isUploadingImage && (
            <HStack spacing={3} p={4} bg="cardBg" borderRadius="md">
              <Spinner size="sm" color="primary" />
              <Text fontSize="sm" color="text">
                Uploading network screenshot to Hive Images...
              </Text>
            </HStack>
          )}

          {uploadedImageUrl && (
            <Box
              p={4}
              bg="cardBg"
              borderRadius="md"
              border="1px solid"
              borderColor="border"
            >
              <HStack spacing={3} mb={3}>
                <Badge colorScheme="green" size="sm">
                  ✓ Upload Complete
                </Badge>
                <Text fontSize="sm" color="textSecondary">
                  Image uploaded successfully
                </Text>
              </HStack>
              <Image
                src={uploadedImageUrl}
                alt="Network visualization"
                maxH="200px"
                objectFit="contain"
                borderRadius="md"
                border="1px solid"
                borderColor="border"
              />
            </Box>
          )}

          {uploadError && (
            <Alert status="warning" size="sm">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Image upload failed: {uploadError}. The announcement will be
                posted without the network visualization.
              </AlertDescription>
            </Alert>
          )}
        </Box>

        {/* Announcement Preview */}
        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={4} color="primary">
            Announcement Post Preview
          </Text>

          <Box
            p={6}
            bg="cardBg"
            borderRadius="lg"
            border="2px solid"
            borderColor="border"
            maxH={isMobile ? "400px" : "500px"}
            overflowY="auto"
          >
            {announcementContent ? (
              <HiveMarkdown
                markdown={announcementContent}
                className="markdown-body"
              />
            ) : (
              <HStack spacing={3}>
                <Spinner size="sm" color="primary" />
                <Text color="textSecondary">
                  Generating announcement content...
                </Text>
              </HStack>
            )}
          </Box>
        </Box>

        {/* Summary Stats */}
        <Box
          p={4}
          bg="cardBg"
          borderRadius="md"
          border="1px solid"
          borderColor="border"
        >
          <Text fontSize="md" fontWeight="bold" mb={3} color="primary">
            Announcement Summary
          </Text>
          <VStack spacing={2} align="start" fontSize="sm" color="text">
            <HStack justify="space-between" w="full">
              <Text>Recipients mentioned:</Text>
              <Text fontWeight="bold">{Math.min(airdropUsers.length, 10)}</Text>
            </HStack>
            <HStack justify="space-between" w="full">
              <Text>Network image:</Text>
              <Text
                fontWeight="bold"
                color={uploadedImageUrl ? "green.500" : "orange.500"}
              >
                {uploadedImageUrl ? "✓ Included" : "⚠ Not included"}
              </Text>
            </HStack>
            <HStack justify="space-between" w="full">
              <Text>Custom message:</Text>
              <Text
                fontWeight="bold"
                color={customMessage ? "green.500" : "gray.500"}
              >
                {customMessage ? "✓ Included" : "None"}
              </Text>
            </HStack>
          </VStack>
        </Box>

        {/* Information */}
        <Alert status="info" size="sm">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            This announcement will be posted automatically after the airdrop
            execution is complete. Review the content above to ensure everything
            looks correct.
          </AlertDescription>
        </Alert>
      </VStack>
    </>
  );
}
