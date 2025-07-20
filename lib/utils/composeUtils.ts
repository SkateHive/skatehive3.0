import { extractImageUrls } from "@/lib/utils/extractImageUrls";

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

export const insertAtCursor = (
    content: string,
    markdown: string,
    setMarkdown: (value: string) => void
) => {
    const textarea = document.querySelector(
        ".w-md-editor-text-input"
    ) as HTMLTextAreaElement;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = markdown;
        const before = text.substring(0, start);
        const after = text.substring(end);
        setMarkdown(`${before}${content}${after}`);
        // Reset cursor position after React re-render
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + content.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
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

export const uploadToIPFS = async (
    blob: Blob,
    fileName: string
): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const response = await fetch("/api/pinata", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Failed to upload file to IPFS");
    }

    const result = await response.json();
    const ipfsUrl = `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`;
    
    // Automatically add file extension to the IPFS URL
    return ensureImageFilename(ipfsUrl, blob.type, fileName);
};
