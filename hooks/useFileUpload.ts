import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToIpfs, generateVideoIframeMarkdown } from "@/lib/markdown/composeUtils";
import { isHeicFile, convertHeicIfNeeded } from "@/lib/utils/heicToJpeg";

// Optimized hook with better error handling and progress tracking
export const useImageUpload = (insertAtCursor: (content: string) => void) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressingImage, setIsCompressingImage] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleImageUpload = async (url: string | null, fileName?: string) => {
        if (!url) {
            setIsUploading(false);
            setIsCompressingImage(false);
            setUploadProgress(0);
            return;
        }

        setIsUploading(true);
        setIsCompressingImage(false);
        setUploadProgress(0);

        try {
            const blob = await fetch(url).then((res) => res.blob());
            
            // Progress tracking for IPFS upload
            const ipfsUrl = await uploadToIpfs(blob, fileName || "compressed-image.jpg");
            
            // Only include caption if it's meaningful
            const meaningfulCaption = fileName && fileName.trim() && fileName.trim() !== "image" ? fileName : "";
            insertAtCursor(`\n![${meaningfulCaption}](${ipfsUrl})\n`);
            
            setUploadProgress(100);
        } catch (error) {
            console.error("Error uploading compressed image to IPFS:", error);
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
        }
    };

    const createImageTrigger = (imageCompressorRef: React.RefObject<any>) => () => {
        if (isCompressingImage) return;
        setIsCompressingImage(true);
        setUploadProgress(0);
        
        if (imageCompressorRef.current) {
            imageCompressorRef.current.trigger();
            // Reset state after timeout if user cancels
            setTimeout(() => {
                setIsCompressingImage(false);
            }, 100);
        }
    };

    return {
        isUploading,
        isCompressingImage,
        uploadProgress,
        handleImageUpload,
        createImageTrigger,
        setIsUploading,
    };
};

// Enhanced video upload hook with better state management
export const useVideoUpload = (insertAtCursor: (content: string) => void) => {
    const [isCompressingVideo, setIsCompressingVideo] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingMethod, setProcessingMethod] = useState<'api' | 'native' | null>(null);

    const handleVideoUpload = (result: { url?: string; hash?: string } | null, method?: 'api' | 'native') => {
        setIsCompressingVideo(false);
        setUploadProgress(100);
        setProcessingMethod(method || null);
        
        if (result && result.url) {
            console.log('🎬 Video upload successful:', {
                url: result.url,
                hash: result.hash,
                method: method
            });
        } else {
            console.log('❌ Video upload failed or missing URL');
        }
    };

    const createVideoTrigger = (videoUploaderRef: React.RefObject<any>) => () => {
        if (isCompressingVideo) return;
        setIsCompressingVideo(true);
        setUploadProgress(0);
        setProcessingMethod(null);
        
        if (videoUploaderRef.current) {
            videoUploaderRef.current.trigger();
            setTimeout(() => {
                setIsCompressingVideo(false);
            }, 100);
        }
    };

    return {
        isCompressingVideo,
        uploadProgress,
        processingMethod,
        handleVideoUpload,
        createVideoTrigger,
        setUploadProgress,
        setIsCompressingVideo,
    };
};

// Enhanced file drop upload with better error handling
export const useFileDropUpload = (insertAtCursor: (content: string) => void) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadCount, setUploadCount] = useState(0);
    const [errors, setErrors] = useState<string[]>([]);

    const onDrop = async (acceptedFiles: File[]) => {
        setIsUploading(true);
        setUploadCount(acceptedFiles.length);
        setErrors([]);
        
        const results = await Promise.allSettled(
            acceptedFiles.map(async (file) => {
                // Convert HEIC/HEIF → JPEG before any processing
                let fileToUpload: File = isHeicFile(file)
                    ? await convertHeicIfNeeded(file)
                    : file;
                let fileName = fileToUpload.name;
                
                // Image compression for non-GIF/WEBP images
                if (fileToUpload.type.startsWith("image/") && 
                    fileToUpload.type !== "image/gif" && 
                    fileToUpload.type !== "image/webp") {
                    try {
                        const options = {
                            maxSizeMB: 2,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                        };
                        const compressedFile = await imageCompression(fileToUpload, options);
                        fileToUpload = compressedFile;
                        fileName = compressedFile.name;
                    } catch (err) {
                        throw new Error(
                            `Error compressing ${file.name}: ${
                                err instanceof Error ? err.message : err
                            }`
                        );
                    }
                }
                
                const url = await uploadToIpfs(fileToUpload, fileName);
                
                if (fileToUpload.type.startsWith("image/")) {
                    const meaningfulCaption = fileName && fileName.trim() &&
                        !fileName.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi)$/i) ? fileName : "";
                    insertAtCursor(`\n![${meaningfulCaption}](${url})\n`);
                } else if (file.type.startsWith("video/")) {
                    // Insert video as iframe using utility function
                    insertAtCursor(generateVideoIframeMarkdown(url));
                }
                
                return { success: true, fileName };
            })
        );
        
        // Collect errors
        const uploadErrors = results
            .filter((result) => result.status === "rejected")
            .map((result) => (result as PromiseRejectedResult).reason.message);
            
        setErrors(uploadErrors);
        setIsUploading(false);
        setUploadCount(0);
        
        if (uploadErrors.length > 0) {
            console.error("Upload errors:", uploadErrors);
        }
    };

    return {
        isUploading,
        uploadCount,
        errors,
        onDrop,
        clearErrors: () => setErrors([]),
    };
};
