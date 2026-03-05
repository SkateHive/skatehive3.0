import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from "react";
import imageCompression from "browser-image-compression";
import { isHeicFile, convertHeicIfNeeded } from "./heicToJpeg";

export interface ImageCompressorProps {
  onUpload: (url: string | null, fileName?: string, originalFile?: File) => void;
  isProcessing?: boolean;
  hideStatus?: boolean;
}

export interface ImageCompressorRef {
  trigger: () => void;
}

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
];

const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "heic", "heif"];

const statusStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#333",
  fontSize: 14,
};
const errorStyle: React.CSSProperties = {
  ...statusStyle,
  color: "red",
};

const ImageCompressor = forwardRef<ImageCompressorRef, ImageCompressorProps>(
  ({ onUpload, isProcessing = false, hideStatus = false }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      trigger: () => {
        if (inputRef.current && !isProcessing) {
          inputRef.current.value = "";
          inputRef.current.click();
        }
      },
    }));

    useEffect(() => {
      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }, [blobUrl]);

    const handleImageUpload = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      setError("");
      setStatus("");
      const file = event.target.files?.[0];
      if (!file) {
        setStatus("");
        return;
      }

      // Check file extension for unsupported types
      const fileName = file.name.toLowerCase();
      const hasUnsupportedExtension = SUPPORTED_EXTENSIONS.some(
        ext => fileName.endsWith(`.${ext}`) && !SUPPORTED_TYPES.some(type => {
          const extType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          return type === extType || (ext === 'svg' && type === 'image/svg+xml') || (ext === 'bmp' && type === 'image/bmp') || (ext === 'tiff' && type === 'image/tiff');
        })
      );

      // Some browsers report empty MIME for HEIC — also check extension
      const isHeic = isHeicFile(file);
      if (!SUPPORTED_TYPES.includes(file.type) && !isHeic) {
        setError(`Unsupported file type: ${file.type || fileName.split('.').pop()}. Supported types: JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, HEIC`);
        onUpload(null);
        return;
      }

      try {
        // Convert HEIC/HEIF → JPEG before anything else
        let processedFile = file;
        if (isHeic) {
          setStatus("Converting HEIC to JPEG...");
          processedFile = await convertHeicIfNeeded(file);
        }

        setStatus("Compressing image...");
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        // Skip compression for GIF, WebP, and SVG (they're already optimized)
        if (processedFile.type === "image/gif" || processedFile.type === "image/webp" || processedFile.type === "image/svg+xml") {
          setStatus("Preparing image...");
          const url = URL.createObjectURL(processedFile);
          setBlobUrl(url);
          setStatus("Image ready!");
          onUpload(url, processedFile.name, processedFile);
          return;
        }

        const compressedFile = await imageCompression(processedFile, options);
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        const url = URL.createObjectURL(compressedFile);
        setBlobUrl(url);
        setStatus("Image compressed successfully!");
        onUpload(url, compressedFile.name, file);
      } catch (err: any) {
        console.error("Image compression error:", err);
        setError(`Error processing image: ${err.message || 'Unknown error'}`);
        setStatus("");
        onUpload(null);
      }
    };

    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif,.heic,.heif"
          style={{ display: "none" }}
          onChange={handleImageUpload}
          disabled={isProcessing}
        />
        {!hideStatus && status && <div style={statusStyle}>{status}</div>}
        {!hideStatus && error && <div style={errorStyle}>{error}</div>}
      </div>
    );
  }
);

ImageCompressor.displayName = "ImageCompressor";

export default ImageCompressor; 