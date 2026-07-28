"use client";
import { useState, useCallback, useMemo } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Box,
  Text,
  HStack,
  VStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useToast,
} from "@chakra-ui/react";
import Cropper from "react-easy-crop";
import type { Point, Area, MediaSize } from "react-easy-crop";
import { computeCropOutput } from "@/lib/media/cropDimensions";

/** An aspect-ratio preset. `value` is width/height; `null` = Original (no fixed ratio). */
export interface AspectOption {
  label: string;
  value: number | null;
}

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImage: File) => Promise<void> | void;
  /** Fixed aspect ratio (width/height). Used when `aspectOptions` is not provided. */
  aspectRatio?: number;
  /** When provided, renders a preset selector. `null` value = Original (image's own aspect). */
  aspectOptions?: AspectOption[];
  /** Long-side cap for the output canvas. Default 1080 (Instagram-friendly). */
  outputMaxDimension?: number;
  /** Output filename. Default "crop.jpg". */
  outputFileName?: string;
  title?: string;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outWidth: number,
  outHeight: number
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = outWidth;
  canvas.height = outHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export default function ImageCropper({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1000 / 1300,
  aspectOptions,
  outputMaxDimension = 1080,
  outputFileName = "crop.jpg",
  title = "Crop image",
}: ImageCropperProps) {
  const toast = useToast();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Image's natural aspect, learned on load — used for the "Original" preset.
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  // Index into aspectOptions of the selected preset (when presets are used).
  const [selectedAspectIdx, setSelectedAspectIdx] = useState(0);

  const onCropCompleteCallback = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    if (mediaSize.naturalHeight > 0) {
      setNaturalAspect(mediaSize.naturalWidth / mediaSize.naturalHeight);
    }
  }, []);

  // The aspect handed to react-easy-crop. With presets: the selected value, or
  // the image's own aspect for "Original". Otherwise the fixed aspectRatio.
  const effectiveAspect = useMemo(() => {
    if (aspectOptions && aspectOptions.length > 0) {
      const opt = aspectOptions[Math.min(selectedAspectIdx, aspectOptions.length - 1)];
      return opt.value ?? naturalAspect ?? aspectRatio;
    }
    return aspectRatio;
  }, [aspectOptions, selectedAspectIdx, naturalAspect, aspectRatio]);

  const handleCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const { width, height } = computeCropOutput(effectiveAspect, outputMaxDimension);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, width, height);
      if (croppedBlob) {
        const file = new File([croppedBlob], outputFileName, { type: "image/jpeg" });
        await onCropComplete(file);
        onClose();
      } else {
        toast({
          title: "Cropping failed",
          description: "Unable to process the image. Please try again.",
          status: "error",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error cropping image:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred while processing the image.",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, effectiveAspect, outputMaxDimension, imageSrc, outputFileName, onCropComplete, onClose, toast]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="background">
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            {aspectOptions && aspectOptions.length > 0 && (
              <HStack spacing={2} w="100%" justify="center" flexWrap="wrap">
                {aspectOptions.map((opt, i) => (
                  <Button
                    key={opt.label}
                    size="sm"
                    variant={i === selectedAspectIdx ? "solid" : "outline"}
                    colorScheme="green"
                    onClick={() => {
                      setSelectedAspectIdx(i);
                      setCrop({ x: 0, y: 0 });
                      setZoom(1);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </HStack>
            )}
            <Box width="100%" height="500px" position="relative">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={effectiveAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropCompleteCallback}
                onMediaLoaded={onMediaLoaded}
              />
            </Box>
            <Box width="100%">
              <Text fontSize="sm" mb={2}>
                Zoom
              </Text>
              <Slider min={1} max={3} step={0.1} value={zoom} onChange={setZoom}>
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={isProcessing}>
            Cancel
          </Button>
          <Button
            colorScheme="green"
            onClick={handleCrop}
            isLoading={isProcessing}
            loadingText="Uploading..."
          >
            Crop & Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
