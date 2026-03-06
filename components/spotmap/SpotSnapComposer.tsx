import React, { useState, useRef } from "react";
import {
  Box,
  Textarea,
  HStack,
  Button,
  Image,
  IconButton,
  Wrap,
  Spinner,
  Progress,
  Input,
  FormControl,
  FormLabel,
  VStack,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useAioha } from "@aioha/react-ui";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import { CloseIcon } from "@chakra-ui/icons";
import { FaImage } from "react-icons/fa";
import { Discussion } from "@hiveio/dhive";
import { getFileSignature, uploadImage } from "@/lib/hive/client-functions";
import { getLastSnapsContainer } from "@/lib/hive/client-functions";
import { HIVE_CONFIG } from "@/config/app.config";
import ImageCompressor, {
  ImageCompressorRef,
} from "@/lib/utils/ImageCompressor";
import MatrixOverlay from "../graphics/MatrixOverlay";
import imageCompression from "browser-image-compression";
import * as exifr from "exifr";

interface SpotSnapComposerProps {
  onNewComment: (newComment: Partial<Discussion>) => void;
  onClose: () => void;
}

export default function SpotSnapComposer({
  onNewComment,
  onClose,
}: SpotSnapComposerProps) {
  const t = useTranslations('map');
  const { user, aioha } = useAioha();
  const { handle: effectiveUser } = useEffectiveHiveUser();
  const postBodyRef = useRef<HTMLTextAreaElement>(null);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const [compressedImages, setCompressedImages] = useState<
    { url: string; fileName: string; caption: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [spotName, setSpotName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [address, setAddress] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const buttonText = () => {
    return t('publish');
  };

  const handleCompressedImageUpload = async (
    url: string | null,
    fileName?: string,
    originalFile?: File
  ) => {
    if (!url) return;
    setIsLoading(true);
    try {
      const blob = await fetch(url).then((res) => res.blob());
      const file = new File([blob], fileName || "compressed.jpg", {
        type: blob.type,
      });

      // Extract GPS from original file if available
      if (originalFile) {
        await extractGPS(originalFile);
      }

      const signature = await getFileSignature(file);
      const uploadUrl = await uploadImage(
        file,
        signature,
        compressedImages.length,
        setUploadProgress
      );
      if (uploadUrl) {
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption: "" },
        ]);
      }
    } catch (error) {
      console.error("Error uploading compressed image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  async function handleComment() {
    let description = postBodyRef.current?.value || "";
    // Only require spot name and either description or images
    if (!spotName.trim()) {
      alert(t('spotNameRequired'));
      return;
    }
    if (!description.trim() && compressedImages.length === 0) {
      alert(t('descriptionOrImageRequired'));
      return;
    }

    // Check if we have location data
    const hasCoords = lat.trim() && lon.trim();
    const hasAddress = address.trim();
    const hasLocation = hasCoords || hasAddress;

    // Warn user if no location data, but allow posting
    if (!hasLocation) {
      const proceed = confirm(
        t('noLocationWarning')
      );
      if (!proceed) return;
    }
    setIsLoading(true);
    setUploadProgress([]);
    const permlink = new Date()
      .toISOString()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    let validUrls: string[] = compressedImages.map((img) => img.url);
    // Compose the post body
    let locationLine = "";
    if (hasCoords && hasAddress && address.trim() !== `${lat}, ${lon}`) {
      // Only show both if address is different from coordinates
      locationLine = `🌐 ${lat}, ${lon} (${address})`;
    } else if (hasCoords) {
      locationLine = `🌐 ${lat}, ${lon}`;
    } else if (hasAddress) {
      locationLine = `🌐 ${address}`;
    } else {
      locationLine =
        "🌐 [To be added - edit this post to add location details]";
    }
    let commentBody = `Spot Name: ${spotName}\n${locationLine}\n`;
    if (description) commentBody += `\n${description}`;
    if (validUrls.length > 0) {
      const imageMarkup = validUrls
        .map((url: string | null, idx: number) => {
          const caption = compressedImages[idx]?.caption;
          // Only include caption if it's meaningful (not empty and not just the spot name)
          const meaningfulCaption =
            caption && caption.trim() && caption.trim() !== spotName
              ? caption
              : "";
          return `![${meaningfulCaption}](${url?.toString() || ""})`;
        })
        .join("\n");
      commentBody += `\n\n${imageMarkup}`;
    }
    try {
      // Get the current main snaps container
      const container = await getLastSnapsContainer();
      const parentAuthor = container.author;
      const parentPermlink = container.permlink;
      let commentResponse: any = null;
      if (user) {
        commentResponse = await aioha.comment(
          parentAuthor,
          parentPermlink,
          permlink,
          "",
          commentBody,
          { app: "Skatehive App 3.0", tags: [HIVE_CONFIG.COMMUNITY_TAG, "skatespot"] }
        );
      } else {
        const response = await fetch("/api/userbase/hive/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_author: parentAuthor,
            parent_permlink: parentPermlink,
            permlink,
            title: "",
            body: commentBody,
            json_metadata: {
              app: "Skatehive App 3.0",
              tags: [HIVE_CONFIG.COMMUNITY_TAG, "skatespot"],
            },
            type: "snap",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to post");
        }
        commentResponse = { success: true, author: data?.author || effectiveUser };
      }
      if (commentResponse.success) {
        postBodyRef.current!.value = "";
        setCompressedImages([]);
        setSpotName("");
        setLat("");
        setLon("");
        setAddress("");
        // Set created to "just now" for optimistic update
        const newComment: Partial<Discussion> = {
          author: commentResponse?.author || effectiveUser,
          permlink: permlink,
          body: commentBody,
          created: "just now",
          pending_payout_value: "0.000 HBD",
        };
        onNewComment(newComment);
        onClose();
      }
    } finally {
      setIsLoading(false);
      setUploadProgress([]);
    }
  }

  // Detect Ctrl+Enter or Command+Enter and submit
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleComment();
    }
  }

  // Helper function to translate Spanish coordinate directions
  const translateCoordinateDirection = (coord: string): string => {
    if (!coord) return coord;
    // Replace Spanish "O" (Oeste/West) with "W"
    return coord.replace(/^O\s*/, "W").replace(/\s*O$/, " W");
  };

  // Add this function to extract GPS from image files
  const extractGPS = async (file: File) => {
    try {
      // Log file details for debugging
      const fileInfo = `File: ${file.name} (${file.type}, ${Math.round(
        file.size / 1024
      )}KB)`;
      console.log("🔍 GPS Debug:", fileInfo);

      const gps = await exifr.gps(file);
      console.log("🔍 GPS Data:", gps);

      if (gps && gps.latitude && gps.longitude) {
        const latStr = translateCoordinateDirection(gps.latitude.toString());
        const lonStr = translateCoordinateDirection(gps.longitude.toString());
        setLat(latStr);
        setLon(lonStr);
        // Don't auto-fill address with coordinates to avoid duplication
        console.log("✅ GPS coordinates extracted successfully");
        return true; // Return true if GPS data was found
      } else {
        // No GPS data found - just log it, no need to alert user
        console.log("⚠️ No GPS data found in image:", fileInfo);
      }
    } catch (e) {
      // Error reading EXIF - just log it, no need to alert user
      console.error("❌ GPS extraction error:", e);
    }
    return false; // Return false if no GPS data found
  };

  // Drag and drop handlers (reuse SnapComposer style)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        // Extract GPS from EXIF if available
        const hasGPS = await extractGPS(file);
        // For dropped images, compress and upload
        try {
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          const url = URL.createObjectURL(compressedFile);
          await handleCompressedImageUpload(url, compressedFile.name, file);
          URL.revokeObjectURL(url);
        } catch (err) {
          alert(
            "Error compressing image: " +
              (err instanceof Error ? err.message : err)
          );
        }
      } else {
        alert(t('onlyImagesSupported'));
      }
    }
  };

  return (
    <Box
      p={4}
      mb={1}
      borderRadius="md"
      borderBottom={"1px"}
      borderColor="muted"
      position="relative"
      maxHeight="600px"
      overflowY="auto"
      bg="background"
      color="text"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: isDragOver
          ? "2px dashed var(--chakra-colors-primary)"
          : undefined,
        background: isDragOver ? "rgba(0,0,0,0.04)" : undefined,
        transition: "border 0.2s, background 0.2s",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      sx={{
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {/* Optionally, overlay a message when dragging */}
      {isDragOver && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={10}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="rgba(0,0,0,0.08)"
          borderRadius="base"
          pointerEvents="none"
        >
          <Box color="primary" fontWeight="bold" fontSize="xl">
            {t('dropImagesToUpload')}
          </Box>
        </Box>
      )}
      <VStack spacing={3} align="stretch">
        <FormControl isRequired>
          <FormLabel>{t('name')}</FormLabel>
          <Input
            id="spot-name-field"
            placeholder={t('enterSpotName')}
            value={spotName}
            onChange={(e) => setSpotName(e.target.value)}
            isDisabled={isLoading}
            borderColor="muted"
            bg="background"
            _focus={{ borderColor: "primary" }}
            _placeholder={{ color: "gray.500" }}
          />
        </FormControl>
        <FormControl>
          <FormLabel>
            {t('location')}{" "}
            {!lat && !lon && compressedImages.length > 0 && (
              <Box as="span" color="orange.500" fontSize="sm">
                {t('noGpsDataFound')}
              </Box>
            )}
          </FormLabel>
          <Input
            placeholder={
              lat && lon ? `${lat}, ${lon}` : t('locationPlaceholder')
            }
            value={lat && lon ? `${lat}, ${lon}` : address}
            onChange={(e) => setAddress(e.target.value)}
            isDisabled={isLoading}
            borderColor="muted"
            bg={lat && lon ? "muted" : "background"}
            _focus={{ borderColor: "primary" }}
            _placeholder={{ color: "gray.500" }}
          />
        </FormControl>
        <FormControl>
          <Textarea
            placeholder={t('describeTheSpot')}
            bg="background"
            borderRadius={"base"}
            mb={3}
            ref={postBodyRef}
            _placeholder={{ color: "text" }}
            isDisabled={isLoading}
            onKeyDown={handleKeyDown}
            borderColor="muted"
            _focus={{ borderColor: "primary" }}
            _focusVisible={{ border: "tb1" }}
          />
        </FormControl>
        <HStack spacing={4} width="100%">
          <Button
            variant="ghost"
            size="lg"
            flex="1"
            isDisabled={isLoading}
            onClick={() => imageCompressorRef.current?.trigger()}
            border="2px solid"
            borderColor="muted"
            _hover={{
              borderColor: "primary",
              boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
            }}
            _active={{ borderColor: "accent" }}
            flexDirection="column"
            height="auto"
            py={3}
          >
            <FaImage size={28} />
            <Box fontSize="sm" mt={1}>
              {t('upload')}{" "}
              <Box as="span" color="red.500">
                *
              </Box>
            </Box>
          </Button>
          <Button
            bg="primary"
            color="background"
            size="lg"
            flex="1"
            _hover={{ bg: "accent", color: "text" }}
            onClick={handleComment}
            isDisabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" /> : buttonText()}
          </Button>
        </HStack>
        <ImageCompressor
          ref={imageCompressorRef}
          onUpload={handleCompressedImageUpload}
          isProcessing={isLoading}
          hideStatus={true}
        />
        <Wrap spacing={4}>
          {compressedImages.map((imgObj, index) => (
            <Box key={index} position="relative" mb={4}>
              <Image
                alt={imgObj.fileName}
                src={imgObj.url}
                boxSize="100px"
                borderRadius="base"
              />
              <Input
                mt={2}
                placeholder={t('caption')}
                value={imgObj.caption}
                onChange={(e) => {
                  const newImages = [...compressedImages];
                  newImages[index].caption = e.target.value;
                  setCompressedImages(newImages);
                }}
                size="sm"
                width="100px"
              />
              <IconButton
                aria-label="Remove image"
                icon={<CloseIcon />}
                size="xs"
                position="absolute"
                top="0"
                right="0"
                onClick={() =>
                  setCompressedImages((prevImages) =>
                    prevImages.filter((_, i) => i !== index)
                  )
                }
                isDisabled={isLoading}
              />
              <Progress
                value={uploadProgress[index]}
                size="xs"
                colorScheme="green"
                mt={2}
              />
            </Box>
          ))}
        </Wrap>
      </VStack>
      {/* Matrix Overlay and login prompt if not logged in */}
      {!user && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={20}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="rgba(0,0,0,0.85)"
          borderRadius="base"
          pointerEvents="all"
        >
          <Box
            color="primary"
            fontWeight="bold"
            fontSize="xl"
            textAlign="center"
          >
            {t('pleaseLoginToPost')}
          </Box>
        </Box>
      )}
    </Box>
  );
}
