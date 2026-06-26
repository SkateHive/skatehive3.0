import React from "react";
import { VStack, HStack, Text, Button, Box, Image } from "@chakra-ui/react";

interface ThumbnailCaptureProps {
  thumbnailUrl: string | null;
  isGeneratingThumbnail: boolean;
  onCaptureFrame: () => void;
  /** Open the crop/position editor on the current frame (optional). */
  onCropFrame?: () => void;
}

const ThumbnailCapture: React.FC<ThumbnailCaptureProps> = ({
  thumbnailUrl,
  isGeneratingThumbnail,
  onCaptureFrame,
  onCropFrame,
}) => {
  return (
    <VStack width="100%" spacing={4}>
      <HStack spacing={2}>
        <Button
          size="sm"
          variant="outline"
          onClick={onCaptureFrame}
          colorScheme="green"
          isLoading={isGeneratingThumbnail}
          loadingText="Capturing..."
        >
          {thumbnailUrl ? "Update Frame" : "Capture Frame"}
        </Button>
        {onCropFrame && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCropFrame}
            colorScheme="green"
            isDisabled={isGeneratingThumbnail}
          >
            Crop & position
          </Button>
        )}
      </HStack>

      {/* Thumbnail Preview */}
      {thumbnailUrl ? (
        <Box
          width="200px"
          height="112px"
          borderRadius="none"
          overflow="hidden"
          border="2px solid"
          borderColor="green.500"
          position="relative"
          mx="auto"
        >
          <Image
            src={thumbnailUrl}
            alt="Video thumbnail"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Box>
      ) : (
        <Box
          width="200px"
          height="112px"
          borderRadius="none"
          border="2px dashed"
          borderColor="gray.500"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mx="auto"
          bg="gray.700"
        >
          <Text fontSize="sm" color="gray.400" textAlign="center">
            No thumbnail captured
            <br />
            Auto-generated on upload
          </Text>
        </Box>
      )}
    </VStack>
  );
};

export default ThumbnailCapture;
