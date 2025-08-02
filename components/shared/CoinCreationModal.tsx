"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  HStack,
  Image,
  Text,
  Alert,
  AlertIcon,
  FormErrorMessage,
  Box,
  useToast,
  Badge,
} from "@chakra-ui/react";
import { useState, useRef, useCallback } from "react";
import { useCoinCreation, CoinCreationData } from "@/hooks/useCoinCreation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

interface CoinCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  postData: {
    title: string;
    body: string;
    author: string;
    permlink: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
    images: string[];
    videos?: string[];
  };
}

// Subcomponents
interface ImagePreviewProps {
  images: string[];
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ images }) => (
  <Box border="1px" borderColor={"primary"} borderRadius="md" p={2} w="full">
    <Text fontSize="xs" mb={2} color="muted">
      Using post image
    </Text>
    <Image
      src={images[0]}
      alt="Coin image from post"
      maxH="200px"
      objectFit="contain"
      borderRadius="md"
      mx="auto"
      display="block"
    />
    {images[0].toLowerCase().endsWith(".gif") && (
      <Text fontSize="xs" color="primary" mt={2} textAlign="center">
        GIF will be used as coin image
      </Text>
    )}
  </Box>
);

interface VideoPreviewProps {
  videos: string[];
  thumbnailUrl?: string;
  thumbnailFile?: File;
  onThumbnailCapture: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onVideoLoad: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videos,
  thumbnailUrl,
  thumbnailFile,
  onThumbnailCapture,
  videoRef,
  onVideoLoad,
}) => {
  // Process video URL
  const videoUrl = videos[0];
  const iframeSrcMatch = videoUrl.match(/src=["']([^"']+)["']/);
  let src = iframeSrcMatch ? iframeSrcMatch[1] : videoUrl;
  src = src.replace(/^['"]+|['"]+$/g, "");

  try {
    src = src.replace(/&amp;/g, "&");
    src = decodeURIComponent(src);
  } catch (e) {}

  let finalSrc = src;
  if (src.startsWith("/ipfs/")) {
    finalSrc = `https://ipfs.skatehive.app${src}`;
  } else if (src.startsWith("ipfs://")) {
    finalSrc = `https://ipfs.skatehive.app/ipfs/${src.replace("ipfs://", "")}`;
  }

  return (
    <Box border="1px" borderColor={"primary"} borderRadius="md" p={2} w="full">
      <Text fontSize="xs" mb={2} color="muted">
        Video content detected
      </Text>
      <Box
        borderRadius="md"
        overflow="hidden"
        maxWidth="300px"
        mx="auto"
        mb={2}
      >
        <video
          key={finalSrc}
          src={finalSrc}
          controls
          ref={videoRef}
          style={{
            width: "100%",
            maxHeight: "200px",
            borderRadius: "8px",
            background: "#111",
          }}
          poster={thumbnailUrl}
          onLoadedData={onVideoLoad}
          onError={(e) => {
            const target = e.target as HTMLVideoElement;
            target.poster = "https://placehold.co/300x200?text=Video+not+found";
          }}
        >
          Sorry, your browser doesnt support embedded videos.
        </video>
        <Button size="xs" mt={2} onClick={onThumbnailCapture}>
          Capture Thumbnail from Current Frame (Optional)
        </Button>
        {thumbnailUrl && (
          <Box mt={2} textAlign="center">
            <Text fontSize="xs" color="primary">
              Selected Thumbnail Preview:
            </Text>
            <Image
              src={thumbnailUrl}
              alt="Selected thumbnail"
              maxH="100px"
              mx="auto"
              borderRadius="md"
              mt={1}
            />
          </Box>
        )}
      </Box>
      <Text fontSize="xs" color="primary" mt={2} textAlign="center">
        ✨ Video will be used as animation, thumbnail generation is optional
      </Text>
    </Box>
  );
};

interface CoinFormProps {
  formData: {
    name: string;
    symbol: string;
    description: string;
  };
  errors: { [key: string]: string };
  onFormChange: (field: string, value: string) => void;
}

const CoinForm: React.FC<CoinFormProps> = ({
  formData,
  errors,
  onFormChange,
}) => (
  <>
    <FormControl isInvalid={!!errors.name}>
      <FormLabel>Coin Name</FormLabel>
      <Input
        value={formData.name}
        onChange={(e) => onFormChange("name", e.target.value)}
        placeholder="Enter coin name (e.g., My Skate Trick)"
      />
      <FormErrorMessage>{errors.name}</FormErrorMessage>
    </FormControl>

    <FormControl isInvalid={!!errors.symbol}>
      <FormLabel>Symbol</FormLabel>
      <Input
        value={formData.symbol}
        onChange={(e) => onFormChange("symbol", e.target.value.toUpperCase())}
        placeholder="Enter symbol (e.g., TRICK)"
        maxLength={8}
      />
      <FormErrorMessage>{errors.symbol}</FormErrorMessage>
    </FormControl>

    <FormControl isInvalid={!!errors.description}>
      <FormLabel>Description</FormLabel>
      <Textarea
        value={formData.description}
        onChange={(e) => onFormChange("description", e.target.value)}
        placeholder="Describe your coin..."
        rows={4}
      />
      <FormErrorMessage>{errors.description}</FormErrorMessage>
    </FormControl>
  </>
);

export function CoinCreationModal({
  isOpen,
  onClose,
  postData,
}: CoinCreationModalProps) {
  const { createCoinFromPost, isCreating } = useCoinCreation();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Network validation hooks
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Create post link for description
  const postLink = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/post/${postData.author}/${postData.permlink}`;

  const [formData, setFormData] = useState({
    name: postData.title || "",
    symbol: "",
    description: postData.body
      ? `${postData.body}\n\nOriginal post: ${postLink}`
      : `Original post: ${postLink}`,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  // For video thumbnail picker
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>(
    undefined
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    undefined
  );

  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleThumbnailCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // For cross-origin videos (like IPFS), we can't use canvas due to CORS
    // Instead, we'll use a different approach or let the backend handle it
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // This will fail for cross-origin videos due to CORS
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              setThumbnailUrl(url);
              setThumbnailFile(
                new File([blob], "thumbnail.jpg", { type: blob.type })
              );
            }
          },
          "image/jpeg",
          0.92
        );
      }
    } catch (error) {
      console.warn("Failed to capture thumbnail due to CORS:", error);
      toast({
        title: "Thumbnail Capture Failed",
        description:
          "Cannot capture thumbnail from cross-origin video. The coin will be created without a custom thumbnail.",
        status: "warning",
        duration: 3000,
      });
    }
  }, [toast]); // Auto-capture first frame when video loads
  const handleVideoLoad = useCallback(() => {
    if (!thumbnailFile && videoRef.current) {
      // Wait a bit for video to be ready
      setTimeout(() => {
        handleThumbnailCapture();
      }, 100);
    }
  }, [thumbnailFile, handleThumbnailCapture]);

  // Network validation
  const validateNetwork = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create coins.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (chainId !== base.id) {
      try {
        await switchChain({ chainId: base.id });
        toast({
          title: "Network Switched",
          description: "Successfully switched to Base network.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        return true;
      } catch (error) {
        toast({
          title: "Network Switch Required",
          description:
            "Please switch to Base network to create coins. Go to your wallet and switch networks manually.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return false;
      }
    }

    return true;
  }, [isConnected, chainId, switchChain, toast]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = "Coin name is required";
    }
    if (!formData.symbol.trim()) {
      newErrors.symbol = "Symbol is required";
    } else if (formData.symbol.length > 8) {
      newErrors.symbol = "Symbol must be 8 characters or less";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    // Don't require image/video here - let the submit handle it
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchImageAsFile = async (imageUrl: string): Promise<File> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const filename = imageUrl.split("/").pop() || "coin-image.jpg";
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      throw new Error("Failed to fetch image from URL");
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Check network before proceeding
    const isNetworkValid = await validateNetwork();
    if (!isNetworkValid) return;

    let imageFile: File | undefined;
    let videoUrl: string | undefined;

    // Handle images
    if (postData.images.length > 0) {
      try {
        imageFile = await fetchImageAsFile(postData.images[0]);
      } catch (error) {
        setErrors((prev) => ({ ...prev, image: "Failed to load image" }));
        return;
      }
    }

    // Handle videos - similar to CoinCreatorComposer
    if (postData.videos && postData.videos.length > 0) {
      // Extract and clean video URL
      const rawVideoUrl = postData.videos[0];
      const iframeSrcMatch = rawVideoUrl.match(/src=["']([^"']+)["']/);
      let cleanVideoUrl = iframeSrcMatch ? iframeSrcMatch[1] : rawVideoUrl;
      cleanVideoUrl = cleanVideoUrl.replace(/^['"]+|['"]+$/g, "");

      try {
        cleanVideoUrl = cleanVideoUrl.replace(/&amp;/g, "&");
        cleanVideoUrl = decodeURIComponent(cleanVideoUrl);
      } catch (e) {}

      if (cleanVideoUrl.startsWith("/ipfs/")) {
        cleanVideoUrl = `https://ipfs.skatehive.app${cleanVideoUrl}`;
      } else if (cleanVideoUrl.startsWith("ipfs://")) {
        cleanVideoUrl = `https://ipfs.skatehive.app/ipfs/${cleanVideoUrl.replace(
          "ipfs://",
          ""
        )}`;
      }

      videoUrl = cleanVideoUrl;

      // If user captured a thumbnail, use it. Otherwise, let Zora SDK handle it
      if (thumbnailFile) {
        imageFile = thumbnailFile;
      }
      // If no thumbnail and no image, we'll still proceed and let Zora handle thumbnail generation
    }

    // Ensure we have either an image or video
    if (!imageFile && !videoUrl) {
      setErrors((prev) => ({
        ...prev,
        image: "Post must have images or videos to create a coin",
      }));
      return;
    }

    const coinData: CoinCreationData = {
      name: formData.name,
      symbol: formData.symbol.toUpperCase(),
      description: formData.description,
      // For videos: use thumbnail as image, video URL as mediaUrl
      image: imageFile,
      ...(videoUrl && {
        mediaUrl: videoUrl,
        animationUrl: videoUrl,
      }),
      postAuthor: postData.author,
      postPermlink: postData.permlink,
      postBody: postData.body,
      postJsonMetadata: postData.json_metadata,
      postTitle: postData.title,
      postParentAuthor: postData.parent_author,
      postParentPermlink: postData.parent_permlink,
    };

    try {
      await createCoinFromPost(coinData);
      onClose();
      setFormData({
        name: "",
        symbol: "",
        description: `Original post: ${postLink}`,
      });
      setErrors({});
      setThumbnailFile(undefined);
      setThumbnailUrl(undefined);
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleClose = () => {
    onClose();
    setErrors({});
    setThumbnailFile(undefined);
    setThumbnailUrl(undefined);
  };

  // Get modal content based on post data
  const getMediaContent = () => {
    const hasImages = postData.images.length > 0;
    const hasVideos = postData.videos && postData.videos.length > 0;

    if (hasImages && !hasVideos) {
      return <ImagePreview images={postData.images} />;
    }

    if (hasVideos && !hasImages) {
      return (
        <VideoPreview
          videos={postData.videos!}
          thumbnailUrl={thumbnailUrl}
          thumbnailFile={thumbnailFile}
          onThumbnailCapture={handleThumbnailCapture}
          videoRef={videoRef}
          onVideoLoad={handleVideoLoad}
        />
      );
    }

    return (
      <Text color="error" fontSize="sm">
        No images or videos found in post
      </Text>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent bg={"background"} border="1px" borderColor={"primary"}>
        <ModalHeader>
          <HStack justify="space-between" align="center">
            <Text>Create Coin from Post</Text>
            {isConnected && (
              <Badge
                colorScheme={chainId === base.id ? "green" : "red"}
                fontSize="xs"
              >
                {chainId === base.id ? "✓ Base Network" : "⚠️ Wrong Network"}
              </Badge>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4}>
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">
                Create a tradeable coin based on your Skatehive post. This will
                deploy a new coin contract on the blockchain.
              </Text>
            </Alert>

            {/* Network Connection Alert */}
            {!isConnected && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">
                  Please connect your wallet to create coins. Make sure
                  you&apos;re on the Base network.
                </Text>
              </Alert>
            )}

            {isConnected && chainId !== base.id && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <VStack align="start" spacing={2}>
                  <Text fontSize="sm">
                    You&apos;re connected to the wrong network. Please switch to
                    Base network to create coins.
                  </Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => validateNetwork()}
                    isLoading={isCreating}
                  >
                    Switch to Base Network
                  </Button>
                </VStack>
              </Alert>
            )}

            <CoinForm
              formData={formData}
              errors={errors}
              onFormChange={handleFormChange}
            />

            <FormControl isInvalid={!!errors.image}>
              <FormLabel>Coin Media</FormLabel>
              <VStack spacing={3}>
                {getMediaContent()}
                <FormErrorMessage>{errors.image}</FormErrorMessage>
              </VStack>
            </FormControl>

            <HStack spacing={3} w="full" pt={4}>
              <Button variant="outline" onClick={handleClose} flex={1}>
                Cancel
              </Button>
              <Button
                bg="primary"
                color="background"
                _hover={{ bg: "accent" }}
                onClick={handleSubmit}
                isLoading={isCreating}
                loadingText="Creating Coin..."
                isDisabled={!isConnected || chainId !== base.id}
                flex={1}
              >
                {!isConnected
                  ? "Connect Wallet"
                  : chainId !== base.id
                  ? "Switch to Base Network"
                  : "Create Coin"}
              </Button>
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
