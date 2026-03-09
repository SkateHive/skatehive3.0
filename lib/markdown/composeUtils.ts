import { extractImageUrls } from "@/lib/utils/extractImageUrls";

import { APP_CONFIG } from "@/config/app.config";

// Helper function to get file extension from MIME type
const getExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp'
    };
    return mimeToExt[mimeType] || 'jpg';
};

// Helper function to get file extension from filename
const getExtensionFromFilename = (filename: string): string => {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : 'jpg';
};

export const ensureImageFilename = (url: string, mimeType?: string, filename?: string): string => {
    // If URL already has a filename parameter, return as is
    if (url.includes("?filename=")) {
        return url;
    }
    
    // Determine the file extension
    let extension = 'jpg'; // default
    if (mimeType) {
        extension = getExtensionFromMimeType(mimeType);
    } else if (filename) {
        extension = getExtensionFromFilename(filename);
    } else if (url.match(/\.(gif|jpg|jpeg|png|webp|svg|bmp)($|\?)/i)) {
        // Extract from URL if it already has an extension
        const match = url.match(/\.(gif|jpg|jpeg|png|webp|svg|bmp)($|\?)/i);
        if (match) {
            extension = match[1].toLowerCase();
            if (extension === 'jpeg') extension = 'jpg';
        }
    }
    
    // Add filename parameter to URL
    const separator = url.includes("?") ? "&" : "?";
    return url + separator + `filename=skatehive.${extension}`;
};

// Keep the old function for backward compatibility
export const ensureGifFilename = (url: string): string => {
    return ensureImageFilename(url, 'image/gif');
};

export const generatePermlink = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-") // replace invalid chars with dash
        .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
        .slice(0, 255); // max length for Hive permlink
};

/**
 * Generate iframe HTML for a video from IPFS URL with SEO metadata
 * Extracts the IPFS hash and creates a properly formatted iframe with Schema.org VideoObject
 */
export const generateVideoIframeMarkdown = (url: string, title?: string): string => {
    // Extract video ID from IPFS URL
    const hashMatch = url.match(/\/ipfs\/([\w-]+)/);
    const videoId = hashMatch ? hashMatch[1] : null;
    
    // Prompt for video title if not provided (for SEO)
    const videoTitle = title || (typeof window !== 'undefined' 
        ? window.prompt('Video title (for SEO):', 'Skateboarding video') || 'Skateboarding video'
        : 'Skateboarding video');
    
    const uploadDate = new Date().toISOString();
    const videoUrl = videoId 
        ? `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${videoId}` 
        : url;
    
    // Create iframe HTML with Schema.org VideoObject metadata
    return `
<div itemscope itemtype="https://schema.org/VideoObject">
  <meta itemprop="name" content="${videoTitle}">
  <meta itemprop="description" content="${videoTitle}">
  <meta itemprop="uploadDate" content="${uploadDate}">
  <iframe src="${videoUrl}" 
    title="${videoTitle}"
    width="100%" 
    height="400"
    frameborder="0"
    loading="lazy"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>
`;
};

export const insertAtCursor = (
    content: string,
    markdown: string,
    setMarkdown: (value: string) => void
) => {
    const textarea = document.querySelector(
        "#markdown-textarea"
    ) as HTMLTextAreaElement;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = markdown.substring(0, start);
        const after = markdown.substring(end);
        const newMarkdown = `${before}${content}${after}`;
        setMarkdown(newMarkdown);
        // Reset cursor position after React re-render
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + content.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    } else {
        // Fallback: just append to the end
        console.warn("Textarea not found, appending to end");
        setMarkdown(markdown + content);
    }
};

export const prepareImageArray = (
    markdown: string,
    selectedThumbnail: string | null
): string[] => {
    const allImages = extractImageUrls(markdown);
    let imageArray: string[] = [];

    if (selectedThumbnail) {
        imageArray = [
            ensureImageFilename(selectedThumbnail),
            ...allImages
                .filter((url) => url !== selectedThumbnail)
                .map((url) => ensureImageFilename(url)),
        ];
    } else {
        imageArray = allImages.map((url) => ensureImageFilename(url));
    }

    return imageArray;
};

export const uploadToIpfs = async (
    blob: Blob,
    fileName: string
): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, fileName);
    
    // Add Pinata metadata for better file management
    const fileType = blob.type.startsWith('image/') ? 'image' : 
                     blob.type.startsWith('video/') ? 'video' : 'file';
    
    const pinataMetadata = {
        name: fileName,
        keyvalues: {
            app: 'skatehive',
            type: fileType,
            uploadedAt: new Date().toISOString(),
            size: blob.size.toString(),
        }
    };
    
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));
    
    // Add Pinata options for better CDN performance
    const pinataOptions = {
        cidVersion: 1, // Use CIDv1 for better gateway compatibility
    };
    
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await fetch("/api/pinata", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Failed to upload file to IPFS");
    }

    const result = await response.json();
    const ipfsUrl = `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${result.IpfsHash}`;
    
    // Automatically add file extension to the IPFS URL
    return ensureImageFilename(ipfsUrl, blob.type, fileName);
};

// Deprecated name kept for backward compatibility
export const uploadToIPFS = uploadToIpfs;
