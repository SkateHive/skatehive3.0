import React, { useState, useRef, useMemo, memo } from "react";
import {
  Box,
  Flex,
  Image,
  Text,
  VStack,
  Spinner,
  IconButton,
} from "@chakra-ui/react";
import { FaUpload, FaCheck, FaTimes } from "react-icons/fa";
import {
  extractImageUrls,
  extractVideoUrls,
} from "@/lib/utils/extractImageUrls";
import { uploadToHiveImagesWithRetry } from "@/lib/utils/imageUpload";

interface ThumbnailPickerProps {
  show: boolean;
  markdown: string;
  selectedThumbnail: string | null;
  setSelectedThumbnail: (thumbnail: string | null) => void;
  uploadedThumbnail?: string | null;
  setUploadedThumbnail?: (thumbnail: string | null) => void;
  uploadedVideoUrl?: string | null;
}

// Memoized thumbnail box to prevent re-renders
const ThumbnailBox = memo(({
    url,
    isVideo = false,
    isSelected,
    onSelect,
    onRemove,
  }: {
    url: string;
    isVideo?: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onRemove?: (e: React.MouseEvent) => void;
  }) => (
    <Box
      border={isSelected ? "2px solid" : "2px solid transparent"}
      borderColor={isSelected ? "primary" : "transparent"}
      overflow="hidden"
      cursor="pointer"
      onClick={onSelect}
      _hover={{ borderColor: "primary" }}
      width="96px"
      height="96px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(255,255,255,0.03)"
      position="relative"
    >
      {isVideo ? (
        <video
          src={url}
          style={{ maxWidth: 90, maxHeight: 90, objectFit: "cover" }}
          preload="metadata"
          muted
        />
      ) : (
        <Image
          src={url}
          alt="thumbnail"
          style={{ maxWidth: 90, maxHeight: 90, objectFit: "cover" }}
        />
      )}
      {isSelected && (
        <Box
          position="absolute"
          top={1}
          right={1}
          bg="primary"
          borderRadius="full"
          p={1}
        >
          <FaCheck size={10} color="var(--chakra-colors-background)" />
        </Box>
      )}
      {onRemove && (
        <IconButton
          aria-label="Remove thumbnail"
          icon={<FaTimes size={12} />}
          size="xs"
          position="absolute"
          top={1}
          left={1}
          bg="rgba(180,80,80,0.5)"
          color="background"
          _hover={{ bg: "rgba(180,80,80,0.7)" }}
          onClick={onRemove}
          borderRadius="full"
          minW="20px"
          h="20px"
        />
      )}
    </Box>
  ));

ThumbnailBox.displayName = "ThumbnailBox";

export default function ThumbnailPicker({
  show,
  markdown,
  selectedThumbnail,
  setSelectedThumbnail,
  uploadedThumbnail: externalUploadedThumbnail,
  setUploadedThumbnail: externalSetUploadedThumbnail,
  uploadedVideoUrl,
}: ThumbnailPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Use external state if provided (persistent), otherwise fallback to local state (legacy)
  const [localUploadedThumbnail, setLocalUploadedThumbnail] = useState<string | null>(null);
  const uploadedThumbnail = externalUploadedThumbnail ?? localUploadedThumbnail;
  const setUploadedThumbnail = externalSetUploadedThumbnail ?? setLocalUploadedThumbnail;

  // Memoize extracted URLs so thumbnails don't re-render on every keystroke
  // Must be called before early return to follow hooks rules
  const imageUrls = useMemo(() => extractImageUrls(markdown), [markdown]);
  const videoUrls = useMemo(() => extractVideoUrls(markdown), [markdown]);

  if (!show) return null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          throw new Error("Failed to read file");
        }

        const result = await uploadToHiveImagesWithRetry(dataUrl, file.name);
        setUploadedThumbnail(result.url);
        setSelectedThumbnail(result.url);
        setUploadError(null);
        setIsUploading(false);
      } catch (error) {
        setIsUploading(false);
        setUploadError(
          error instanceof Error ? error.message : "Upload failed"
        );
      }
    };
    
    reader.onerror = () => {
      setIsUploading(false);
      setUploadError("Failed to read file");
    };
    
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const handleRemoveUploaded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedThumbnail(null);
    if (selectedThumbnail === uploadedThumbnail) {
      setSelectedThumbnail(null);
    }
  };

  return (
    <Box>
      <Text
        letterSpacing="0.08em"
        fontSize="11px"
        color="dim"
        mb={3}
        fontWeight="medium"
        textTransform="uppercase"
      >
        Thumbnail
      </Text>
      <Flex wrap="wrap" gap={3} alignItems="flex-start">
        {uploadedThumbnail && (
          <ThumbnailBox
            url={uploadedThumbnail}
            isSelected={selectedThumbnail === uploadedThumbnail}
            onSelect={() => setSelectedThumbnail(uploadedThumbnail)}
            onRemove={handleRemoveUploaded}
          />
        )}
        {uploadedVideoUrl && (
          <ThumbnailBox 
            url={uploadedVideoUrl} 
            isVideo 
            isSelected={selectedThumbnail === uploadedVideoUrl}
            onSelect={() => setSelectedThumbnail(uploadedVideoUrl)}
          />
        )}
        {imageUrls.map((url, idx) => (
          <ThumbnailBox 
            key={url + idx} 
            url={url} 
            isSelected={selectedThumbnail === url}
            onSelect={() => setSelectedThumbnail(url)}
          />
        ))}
        {videoUrls.map((url, idx) => (
          <ThumbnailBox 
            key={url + idx} 
            url={url} 
            isVideo 
            isSelected={selectedThumbnail === url}
            onSelect={() => setSelectedThumbnail(url)}
          />
        ))}
        <Box
          border="2px dashed"
          borderColor="border"
          overflow="hidden"
          cursor={isUploading ? "wait" : "pointer"}
          onClick={handleUploadClick}
          _hover={{ borderColor: "primary" }}
          width="96px"
          height="96px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="subtle"
          position="relative"
        >
          {isUploading ? (
            <Spinner size="sm" color="primary" />
          ) : (
            <VStack spacing={1}>
              <FaUpload color="var(--chakra-colors-primary)" size={18} />
              <Text fontSize="xs" color="text" textAlign="center">
                Upload
              </Text>
            </VStack>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </Box>
      </Flex>
      {uploadError && (
        <Text color="error" fontSize="sm" mt={2}>
          {uploadError}
        </Text>
      )}
      {selectedThumbnail && (
        <Box mt={2} color="dim" fontSize="sm">
          Selected:{" "}
          <span
            style={{
              wordBreak: "break-all",
              color: "var(--chakra-colors-primary)",
            }}
          >
            {selectedThumbnail}
          </span>
        </Box>
      )}
    </Box>
  );
}
