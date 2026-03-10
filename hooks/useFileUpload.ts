import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToIpfs, generateVideoIframeMarkdown } from "@/lib/markdown/composeUtils";
import { isHeicFile, convertHeicIfNeeded } from "@/lib/utils/heicToJpeg";
import { extractExif, exifToAltText } from "@/lib/utils/exifExtractor";
import { cleanFilename } from "@/lib/seo/metadataGenerator";

// Optimized hook with better error handling and progress tracking
export const useImageUpload = (
    insertAtCursor: (content: string) => void,
    options?: {
        onRequestDescription?: (message: string, config?: {
            tip?: string;
            placeholder?: string;
            defaultValue?: string;
        }) => Promise<string | null>;
    }
) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressingImage, setIsCompressingImage] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleImageUpload = async (url: string | null, fileName?: string, originalFile?: File) => {
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
            
            // Extract EXIF data (if original file available)
            let exifData = null;
            if (originalFile) {
                exifData = await extractExif(originalFile);
            }
            
            // Progress tracking for IPFS upload
            const ipfsUrl = await uploadToIpfs(blob, fileName || "compressed-image.jpg");
            
            // Generate smart alt text
            let altText = '';
            
            // 1. Try to get user description (SEO + accessibility)
            let userDescription: string | null = null;
            
            if (options?.onRequestDescription) {
                // Use custom dialog (e.g., SkateDialog)
                userDescription = await options.onRequestDescription(
                    'Describe this image (for SEO & accessibility):',
                    {
                        tip: 'Tip: Be specific! Example: "Kickflip at Venice Skatepark"',
                        placeholder: 'Type your description here...',
                        defaultValue: '',
                    }
                );
            } else {
                // Fallback to native prompt
                userDescription = window.prompt(
                    'Describe this image (for SEO & accessibility):\n\nTip: Be specific! Example: "Kickflip at Venice Skatepark"',
                    ''
                );
            }
            
            if (userDescription && userDescription.trim()) {
                altText = userDescription.trim();
            } else if (exifData) {
                // 2. Use EXIF data to generate alt text
                altText = exifToAltText(exifData, 'Skateboarding photo');
            } else {
                // 3. Fallback to cleaned filename
                const cleaned = cleanFilename(fileName || '');
                altText = cleaned || 'Skateboarding photo';
            }
            
            // Ensure alt text is meaningful (min 10 chars)
            if (altText.length < 10) {
                altText = 'Skateboarding photo';
            }
            
            // Insert markdown with proper alt text and title attribute
            insertAtCursor(`\n![${altText}](${ipfsUrl} "${altText}")\n`);
            
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
                    // Extract EXIF for better alt text
                    const exifData = await extractExif(fileToUpload);
                    
                    // Generate smart alt text
                    let altText = '';
                    const cleaned = cleanFilename(fileName);
                    
                    if (exifData) {
                        altText = exifToAltText(exifData, 'Skateboarding photo');
                    } else {
                        altText = cleaned || 'Skateboarding photo';
                    }
                    
                    // Ensure meaningful alt text
                    if (altText.length < 10) {
                        altText = 'Skateboarding photo';
                    }
                    
                    insertAtCursor(`\n![${altText}](${url} "${altText}")\n`);
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
