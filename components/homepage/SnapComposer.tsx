import React, { useState, useRef } from "react";
import {
  Box,
  Textarea,
  HStack,
  Button,
  Image,
  IconButton,
  Wrap,
  Progress,
  Input,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import GiphySelector from "./GiphySelector";
import VideoUploader, { VideoUploaderRef } from "./VideoUploader";
import { IGif } from "@giphy/js-types";
import { FaImage } from "react-icons/fa";
import { MdGif } from "react-icons/md";
import { Discussion } from "@hiveio/dhive";
import {
  getFileSignature,
  getLastSnapsContainer,
  uploadImage,
} from "@/lib/hive/client-functions";
import { FaVideo } from "react-icons/fa6";
import { FaTimes } from "react-icons/fa";
import ImageCompressor from "@/lib/utils/ImageCompressor";
import { ImageCompressorRef } from "@/lib/utils/ImageCompressor";
import imageCompression from "browser-image-compression";

interface SnapComposerProps {
  pa: string;
  pp: string;
  onNewComment: (newComment: Partial<Discussion>) => void;
  post?: boolean;
  onClose: () => void;
  submitLabel?: string;
  buttonSize?: "sm" | "md" | "lg";
}

export default function SnapComposer({
  pa,
  pp,
  onNewComment,
  post = false,
  onClose,
  submitLabel,
  buttonSize = "lg",
}: SnapComposerProps) {
  const { user, aioha } = useAioha();
  const postBodyRef = useRef<HTMLTextAreaElement>(null);
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
  const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const [compressedImages, setCompressedImages] = useState<
    { url: string; fileName: string; caption: string }[]
  >([]);
  const gifWebpInputRef = useRef<HTMLInputElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const isUploadingMedia = uploadCount > 0;

  const buttonText = submitLabel || (post ? "Reply" : "Post");

  // Function to extract hashtags from text
  function extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map((hashtag) => hashtag.slice(1)); // Remove the '#' symbol
  }

  // Helper functions to manage upload count
  const startUpload = () => setUploadCount((c) => c + 1);
  const finishUpload = () => setUploadCount((c) => Math.max(0, c - 1));

  // Handler for compressed image upload
  const handleCompressedImageUpload = async (
    url: string | null,
    fileName?: string
  ) => {
    if (!url) return;
    startUpload();
    setIsLoading(true);
    try {
      const blob = await fetch(url).then((res) => res.blob());
      const file = new File([blob], fileName || "compressed.jpg", {
        type: blob.type,
      });
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
      finishUpload();
    }
  };

  const handleGifWebpUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Check file type
    if (!(file.type === "image/gif" || file.type === "image/webp")) {
      alert("Only GIF and WEBP files are allowed.");
      return;
    }
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("GIF or WEBP file size must be 5MB or less.");
      return;
    }
    startUpload();
    setIsLoading(true);
    try {
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
      console.error("Error uploading GIF/WEBP:", error);
    } finally {
      setIsLoading(false);
      finishUpload();
      e.target.value = ""; // Reset input
    }
  };

  // Unified image upload handler
  const handleUnifiedImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) startUpload();
    for (const file of files) {
      if (file.type === "image/gif" || file.type === "image/webp") {
        // Use GIF/WEBP logic
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        await handleGifWebpUpload(fakeEvent);
      } else if (file.type.startsWith("image/")) {
        // Use image compression logic
        try {
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          const url = URL.createObjectURL(compressedFile);
          await handleCompressedImageUpload(url, compressedFile.name);
          URL.revokeObjectURL(url);
        } catch (err) {
          alert(
            "Error compressing image: " +
              (err instanceof Error ? err.message : err)
          );
        }
      } else {
        alert("Unsupported file type: " + file.type);
      }
    }
    finishUpload();
    e.target.value = ""; // Reset input
  };

  async function handleComment() {
    let commentBody = postBodyRef.current?.value || "";

    if (
      !commentBody.trim() &&
      compressedImages.length === 0 &&
      !selectedGif &&
      !videoUrl
    ) {
      alert(
        "Please enter some text, upload an image, select a gif, or upload a video before posting."
      );
      return; // Do not proceed
    }

    setIsLoading(true);
    setUploadProgress([]);

    const permlink = new Date()
      .toISOString()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    let validUrls: string[] = compressedImages.map((img) => img.url);
    if (validUrls.length > 0) {
      const imageMarkup = compressedImages
        .map((img) => `![${img.caption || "image"}](${img.url})`)
        .join("\n");
      commentBody += `\n\n${imageMarkup}`;
    }

    if (selectedGif) {
      commentBody += `\n\n![gif](${selectedGif.images.downsized_medium.url})`;
    }

    if (videoUrl) {
      commentBody += `\n\n<iframe src="${videoUrl}" frameborder="0" allowfullscreen></iframe>`;
    }

    if (commentBody) {
      let snapsTags: string[] = [];
      try {
        // Add existing `snaps` tag logic
        if (pp === "snaps") {
          pp = (await getLastSnapsContainer()).permlink;
          snapsTags = [
            process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG || "",
            "snaps",
          ];
        }

        // Extract hashtags from the comment body and add to `snapsTags`
        const hashtags = extractHashtags(commentBody);
        snapsTags = [...new Set([...snapsTags, ...hashtags])]; // Add hashtags without duplicates

        const commentResponse = await aioha.comment(
          pa,
          pp,
          permlink,
          "",
          commentBody,
          { app: "Skatehive App 3.0", tags: snapsTags, images: validUrls }
        );
        if (commentResponse.success) {
          postBodyRef.current!.value = "";
          setCompressedImages([]);
          setSelectedGif(null);
          setVideoUrl(null);

          // Set created to "just now" for optimistic update
          const newComment: Partial<Discussion> = {
            author: user,
            permlink: permlink,
            body: commentBody,
            created: "just now", // use "just now" as the created value for new replies
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
  }

  // Detect Ctrl+Enter and submit
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.key === "Enter") {
      handleComment();
    }
  }

  // Drag and drop handlers
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

  // Video upload logic in handleDrop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) startUpload();
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        // If GIF or WEBP, use GIF/WEBP upload logic
        if (file.type === "image/gif" || file.type === "image/webp") {
          // Simulate input event for GIF/WEBP
          const fakeEvent = {
            target: { files: [file] },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          await handleGifWebpUpload(fakeEvent);
        } else {
          // For other images, resize and compress before upload
          try {
            const options = {
              maxSizeMB: 2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);
            const url = URL.createObjectURL(compressedFile);
            await handleCompressedImageUpload(url, compressedFile.name);
            URL.revokeObjectURL(url);
          } catch (err) {
            alert(
              "Error compressing image: " +
                (err instanceof Error ? err.message : err)
            );
          }
        }
      } else if (file.type.startsWith("video/")) {
        // For video, use video uploader logic if available
        if (videoUploaderRef.current && videoUploaderRef.current.handleFile) {
          setIsLoading(true);
          try {
            startUpload();
            await videoUploaderRef.current.handleFile(file);
          } catch (error) {
            console.error("Error uploading video:", error);
          } finally {
            setIsLoading(false);
            finishUpload();
          }
        } else {
          alert("Video upload not supported.");
        }
      } else {
        alert("Unsupported file type: " + file.type);
      }
    }
    finishUpload();
  };

  // Video upload state integration
  const handleVideoUploadStart = () => startUpload();
  const handleVideoUploadFinish = () => finishUpload();

  // Only render the composer if user is logged in
  if (!user) return null;

  return (
    <Box position="relative">
      {/* Snap Composer UI, blurred and unclickable if not logged in */}
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragOver
            ? "2px dashed var(--chakra-colors-primary)"
            : undefined,
          background: isDragOver ? "rgba(0,0,0,0.04)" : undefined,
          transition: "border 0.2s, background 0.2s",
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
              Drop files to upload
            </Box>
          </Box>
        )}
        <Box
          p={4}
          mb={1}
          borderRadius="base"
          borderBottom={"1px"}
          borderColor="muted"
        >
          <Textarea
            placeholder="Write here"
            bg="background"
            borderRadius={"base"}
            mb={3}
            ref={postBodyRef}
            _placeholder={{ color: "text" }}
            isDisabled={isLoading}
            onKeyDown={handleKeyDown} // Attach the keydown handler
            _focusVisible={{ border: "tb1" }}
          />
          <HStack justify="space-between" mb={3}>
            <HStack>
              {/* Image Upload Button */}
              <Box position="relative">
                <IconButton
                  aria-label="Upload Image"
                  icon={
                    <FaImage color="var(--chakra-colors-primary)" size={22} />
                  }
                  variant="ghost"
                  isDisabled={isLoading}
                  border="2px solid transparent"
                  borderRadius="full"
                  height="48px"
                  width="48px"
                  p={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{
                    borderColor: "primary",
                    boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                  }}
                  _active={{ borderColor: "accent" }}
                  onClick={() => imageUploadInputRef.current?.click()}
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.heic,.gif,.webp"
                  style={{ display: "none" }}
                  ref={imageUploadInputRef}
                  onChange={handleUnifiedImageUpload}
                  multiple
                />
              </Box>
              {/* Giphy Button (only in reply modal) */}
              {post && (
                <IconButton
                  aria-label="Add GIF from Giphy"
                  icon={
                    <MdGif size={22} color="var(--chakra-colors-primary)" />
                  }
                  variant="ghost"
                  isDisabled={isLoading}
                  border="2px solid transparent"
                  borderRadius="full"
                  height="48px"
                  width="48px"
                  p={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{
                    borderColor: "primary",
                    boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                  }}
                  _active={{ borderColor: "accent" }}
                  onClick={() => setGiphyModalOpen((open) => !open)}
                />
              )}
              <ImageCompressor
                ref={imageCompressorRef}
                onUpload={handleCompressedImageUpload}
                isProcessing={isLoading}
              />
              <Button
                variant="ghost"
                isDisabled={isLoading}
                border="2px solid transparent"
                borderRadius="full"
                height="48px"
                width="48px"
                p={0}
                display="flex"
                alignItems="center"
                justifyContent="center"
                _hover={{
                  borderColor: "primary",
                  boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                }}
                _active={{ borderColor: "accent" }}
                onClick={() => videoUploaderRef.current?.trigger()}
              >
                <FaVideo color="var(--chakra-colors-primary)" size={22} />
              </Button>
            </HStack>
            <Box display={buttonSize === "sm" ? "inline-block" : undefined}>
              <Button
                bg="primary"
                color="background"
                _hover={{ bg: "accent", color: "text" }}
                isLoading={isLoading}
                isDisabled={isLoading || isUploadingMedia}
                onClick={handleComment}
                borderRadius={buttonSize === "sm" ? "sm" : "base"}
                fontWeight="bold"
                size={buttonSize}
                px={buttonSize === "sm" ? 1 : 8}
                py={buttonSize === "sm" ? 0 : 6}
                mt={2}
                mb={1}
                minWidth={buttonSize === "sm" ? undefined : "120px"}
                width={buttonSize === "sm" ? undefined : "30%"}
                maxWidth={buttonSize === "sm" ? undefined : undefined}
                fontSize={buttonSize === "sm" ? "xs" : "lg"}
                lineHeight={buttonSize === "sm" ? "1" : undefined}
                flex={buttonSize === "sm" ? "none" : undefined}
                alignSelf={buttonSize === "sm" ? "flex-start" : undefined}
                display={buttonSize === "sm" ? "inline-flex" : undefined}
                height={buttonSize === "sm" ? "auto" : undefined}
              >
                {buttonText}
              </Button>
            </Box>
          </HStack>
          <Box width="100%">
            <VideoUploader
              ref={videoUploaderRef}
              onUpload={setVideoUrl}
              isProcessing={isLoading}
              username={user || undefined}
              onUploadStart={handleVideoUploadStart}
              onUploadFinish={handleVideoUploadFinish}
            />
          </Box>
          <Wrap spacing={4}>
            {compressedImages.map((img, index) => (
              <Box key={index} position="relative">
                <Image
                  alt={img.fileName}
                  src={img.url}
                  boxSize="100px"
                  borderRadius="base"
                />
                <Input
                  mt={2}
                  placeholder="Enter caption"
                  value={img.caption}
                  onChange={(e) => {
                    const newImages = [...compressedImages];
                    newImages[index].caption = e.target.value;
                    setCompressedImages(newImages);
                  }}
                  size="sm"
                  isDisabled={isLoading}
                />
                <IconButton
                  aria-label="Remove image"
                  icon={<FaTimes />}
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
            {selectedGif && (
              <Box key={selectedGif.id} position="relative">
                <Image
                  alt=""
                  src={selectedGif.images.downsized_medium.url}
                  boxSize="100px"
                  borderRadius="base"
                />
                <IconButton
                  aria-label="Remove GIF"
                  icon={<FaTimes />}
                  size="xs"
                  position="absolute"
                  top="0"
                  right="0"
                  onClick={() => setSelectedGif(null)}
                  isDisabled={isLoading}
                />
              </Box>
            )}
            {videoUrl && (
              <Box position="relative" width="100%">
                <iframe
                  src={videoUrl}
                  title="Uploaded Video"
                  frameBorder="0"
                  style={{
                    width: "100%",
                    minHeight: "435px",
                    borderRadius: "8px",
                    maxWidth: "100vw",
                  }}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <IconButton
                  aria-label="Remove video"
                  icon={<FaTimes />}
                  size="xs"
                  position="absolute"
                  top="0"
                  right="0"
                  onClick={() => setVideoUrl(null)}
                  isDisabled={isLoading}
                />
              </Box>
            )}
          </Wrap>
          {isGiphyModalOpen && (
            <Box position="relative">
              <GiphySelector
                apiKey={
                  process.env.GIPHY_API_KEY ||
                  "qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV"
                }
                onSelect={(gif, e) => {
                  e.preventDefault();
                  setSelectedGif(gif);
                  setGiphyModalOpen(false); // Close modal after selecting a GIF
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
      {/* Matrix Overlay and login prompt if not logged in */}
      {!user && <></>}
    </Box>
  );
}
