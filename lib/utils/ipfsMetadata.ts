/**
 * Utility functions for working with IPFS metadata from Pinata
 */

import { APP_CONFIG } from "@/config/app.config";

export interface IPFSMetadata {
    name: string;
    keyvalues: {
        creator?: string;
        thumbnailUrl?: string;
        fileType?: string;
        uploadDate?: string;
        [key: string]: any;
    };
}

/**
 * Fetch metadata for an IPFS hash from Pinata
 * @param ipfsHash The IPFS hash
 * @returns The metadata object or null if not found
 */
export async function getIPFSMetadata(ipfsHash: string): Promise<IPFSMetadata | null> {
    try {
        const response = await fetch(`/api/pinata/metadata/${ipfsHash}`);

        if (!response.ok) {
            console.warn(`Failed to fetch metadata for ${ipfsHash}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch IPFS metadata:', error);
        return null;
    }
}

/**
 * Extract IPFS hash from a full IPFS URL
 * @param url The full IPFS URL (e.g., https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/QmXXX)
 * @returns The IPFS hash or null if invalid
 */
export function extractIPFSHash(url: string): string | null {
    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

/**
 * Convert IPFS URLs to HTTP gateway URLs with multiple gateway fallbacks
 * @param url The URL to convert (can be ipfs:// or regular HTTP)
 * @param preferredGateway Optional preferred gateway (defaults to trying multiple)
 * @returns HTTP URL that browsers can load
 */
export function convertIpfsUrl(url: string, preferredGateway?: string): string {
    if (!url.startsWith('ipfs://')) {
        return url;
    }

    const hash = url.replace('ipfs://', '');
    
    // If a preferred gateway is specified, use it
    if (preferredGateway) {
        return `${preferredGateway}/ipfs/${hash}`;
    }
    
    // Default to public IPFS gateway for better reliability
    return `https://ipfs.io/ipfs/${hash}`;
}

/**
 * Get multiple IPFS gateway URLs for fallback loading
 * @param url The IPFS URL to convert
 * @returns Array of gateway URLs to try
 */
export function getIpfsGatewayUrls(url: string): string[] {
    if (!url.startsWith('ipfs://')) {
        return [url];
    }

    const hash = url.replace('ipfs://', '');
    
    return [
        `https://magic.decentralized-content.com/ipfs/${hash}`, // Decentralized-content IPFS gateway
        `https://ipfs.io/ipfs/${hash}`,           // Public IPFS gateway (most reliable)
        `https://cloudflare-ipfs.com/ipfs/${hash}`, // Cloudflare IPFS gateway
        `https://gateway.pinata.cloud/ipfs/${hash}`, // Pinata public gateway
        `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${hash}`,   // SkateHive gateway (as fallback)
    ];
}

/**
 * Get thumbnail URL for a video IPFS hash or URL
 * @param input Either an IPFS hash or full IPFS URL
 * @returns The thumbnail URL or null if not available
 */
export async function getVideoThumbnail(input: string): Promise<string | null> {
    // Check if input is already a hash or needs extraction
    let ipfsHash: string | null;
    if (input.includes('/ipfs/')) {
        ipfsHash = extractIPFSHash(input);
    } else {
        ipfsHash = input; // Assume it's already a hash
    }

    if (!ipfsHash) {
        return null;
    }

    const metadata = await getIPFSMetadata(ipfsHash);

    if (!metadata) {
        return null;
    }

    return metadata?.keyvalues?.thumbnailUrl || null;
}

/**
 * Check if a video has a thumbnail available
 * @param videoUrl The video IPFS URL
 * @returns True if thumbnail is available
 */
export async function hasVideoThumbnail(videoUrl: string): Promise<boolean> {
    const thumbnailUrl = await getVideoThumbnail(videoUrl);
    return !!thumbnailUrl;
}
