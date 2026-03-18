import { debugLog } from "@/lib/utils/debugUtils";
import { useState, useCallback } from 'react';
import { createCoin, createMetadataBuilder, createZoraUploaderForCreator, setApiKey } from '@zoralabs/coins-sdk';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain, useChainId } from 'wagmi';
import { useToast } from '@chakra-ui/react';
import { SKATEHIVE_PLATFORM_REFERRER } from '@/components/shared/search/constants';
import { useAioha } from "@aioha/react-ui";
import { base } from 'wagmi/chains';
import { uploadToIpfs } from '@/lib/markdown/composeUtils';
import { Discussion } from "@hiveio/dhive";
import { APP_CONFIG } from "@/config/app.config";

export interface MarkdownCoinData {
  name: string;
  symbol: string;
  description: string;
  markdownContent: string;
  author: string;
  permlink: string;
  postUrl: string;
}

export interface MarkdownCoinResult {
  success: boolean;
  coinAddress: string;
  zoraUrl: string;
  markdownIpfsUrl: string;
  transactionHash: string;
  debugInfo: {
    coinParams: any;
    metadataParameters: any;
    carouselContent: any;
    description: string;
    symbol: string;
    markdownImages: number;
    hasCarousel: boolean;
    timing: {
      total: number;
      image: string;
      ipfs: string;
      metadata: string;
      transaction: string;
    };
    originalPost: {
      title: string;
      author: string;
      permlink: string;
      wordCount: number;
    };
  };
}

// Helper function to extract thumbnail from post
const extractThumbnailFromPost = (post: Discussion): string | null => {
  try {
    // First try to get from json_metadata
    if (post.json_metadata) {
      const metadata = JSON.parse(post.json_metadata);
      if (metadata.image && Array.isArray(metadata.image) && metadata.image[0]) {
        return metadata.image[0];
      }
      if (metadata.thumbnail && Array.isArray(metadata.thumbnail) && metadata.thumbnail[0]) {
        return metadata.thumbnail[0];
      }
    }

    // Extract from markdown content
    const imageMatch = post.body.match(/!\[.*?\]\((.*?)\)/);
    if (imageMatch && imageMatch[1]) {
      return imageMatch[1];
    }

    return null;
  } catch (error) {
    console.warn('Failed to extract thumbnail:', error);
    return null;
  }
};

// Extract all images from markdown content for carousel
const extractMarkdownImages = (content: string): string[] => {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const images: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(content)) !== null) {
    images.push(match[1]);
  }
  
  return images.filter(img => 
    img.match(/\.(jpg|jpeg|png|gif|webp)$/i) && 
    !img.includes('avatar') // Filter out avatar images
  );
};

// Convert image URL to IPFS if needed
const convertToIPFS = async (imageUrl: string): Promise<string> => {
  console.log("🔄 convertToIPFS called with:", imageUrl);
  
  // If already IPFS, return as is
  if (imageUrl.startsWith('ipfs://')) {
    return imageUrl;
  }
  
  try {
    // For HTTP images, upload to IPFS using our upload utility
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'carousel-image.jpg', { type: blob.type });
    
    const ipfsUrl = await uploadToIpfs(file, 'carousel-image.jpg');
    const cleanIpfsUrl = ipfsUrl.split('?')[0]; // Remove query parameters
    return cleanIpfsUrl;
  } catch (error) {
    console.warn('Failed to upload to IPFS, using original URL:', error);
    return imageUrl;
  }
};

// Convert HTML content to clean markdown for description
const convertToMarkdown = (content: string): string => {
  let markdown = content;
  
  // Convert iframe videos to image buttons with thumbnails
  markdown = markdown.replace(
    /<iframe[^>]*src=["']([^"']*(?:youtube\.com\/embed\/|youtu\.be\/|vimeo\.com\/))([^"']*)["'][^>]*><\/iframe>/gi,
    (match, baseUrl, videoId) => {
      // Extract video ID and create thumbnail
      let thumbnailUrl = '';
      let videoUrl = baseUrl + videoId;
      
      if (baseUrl.includes('youtube.com/embed/')) {
        const ytId = videoId.split('?')[0];
        thumbnailUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
      } else if (baseUrl.includes('youtu.be/')) {
        const ytId = videoId.split('?')[0];
        thumbnailUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
      } else if (baseUrl.includes('vimeo.com/')) {
        // For Vimeo, we'll use a generic play button since thumbnail API requires auth
        thumbnailUrl = 'https://i.vimeocdn.com/video/default_300x169.jpg';
      }
      
      return `[![🎥 Watch Video](${thumbnailUrl})](${videoUrl})`;
    }
  );
  
  // Convert other HTML elements to markdown
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  markdown = markdown.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<h([1-6])>(.*?)<\/h[1-6]>/gi, (match, level, text) => {
    return '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
  });
  
  // Convert links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Convert images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*>/gi, '![$1]($2)');
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)');
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // Clean up extra whitespace and line breaks
  markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
  markdown = markdown.replace(/^\s+|\s+$/gm, '');
  
  return markdown.trim();
};

// Create carousel metadata structure for Zora
const createCarouselContent = async (cardImageFile: File, markdownImages: string[]): Promise<any> => {
  try {
    // Upload the generated card to IPFS
    const cardImageIPFS = await uploadToIpfs(cardImageFile, 'nft-card.png');
    const cleanCardImageIPFS = cardImageIPFS.split('?')[0]; // Remove query parameters
    
    const carouselMedia = [
      {
        uri: cleanCardImageIPFS,
        mime: "image/png"
      }
    ];
    
    // Add markdown images to carousel
    for (const imageUrl of markdownImages) {
      try {
        const ipfsUrl = await convertToIPFS(imageUrl);
        const cleanIpfsUrl = ipfsUrl.split('?')[0]; // Remove query parameters
        carouselMedia.push({
          uri: cleanIpfsUrl,
          mime: "image/jpeg" // Default, could be detected
        });
      } catch (error) {
        console.warn('Failed to process image for carousel:', imageUrl, error);
      }
    }
    
    // Always return a carousel structure (even if only the generated card)
    return {
      mime: "image/png", // Main mime type
      uri: `ipfs://${cleanCardImageIPFS.replace(`https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/`, '')}`, // Main image URI with ipfs:// protocol
      type: "CAROUSEL",
      carousel: {
        version: "1.0.0",
        media: carouselMedia.map(item => ({
          uri: `ipfs://${item.uri.replace(`https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/`, '')}`,
          mime: item.mime
        }))
      }
    };
  } catch (error) {
    console.error('Failed to create carousel content:', error);
    // Fallback to simple content
    const cardImageIPFS = await uploadToIpfs(cardImageFile, 'nft-card-fallback.png');
    const cleanCardImageIPFS = cardImageIPFS.split('?')[0]; // Remove query parameters
    return {
      mime: "image/png",
      uri: cleanCardImageIPFS
    };
  }
};

import { generateMarkdownCoinCard } from '@/lib/utils/markdownCoinUtils';

export function useMarkdownCoin() {
  const [isCreating, setIsCreating] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { aioha, user } = useAioha();
  const toast = useToast();

  const createMarkdownCoin = useCallback(async (
    post: Discussion, 
    selectedCarouselImages?: Array<{uri: string, mime: string, type: string, isIncluded: boolean, isGenerated?: boolean}>
  ): Promise<MarkdownCoinResult> => {
      
    const overallStartTime = Date.now();
    console.log('⏱️ Starting coin creation process...');
    
    // Timing variables
    let imageStartTime = 0, imageEndTime = 0;
    let ipfsStartTime = 0, ipfsEndTime = 0;
    let metadataUploadStartTime = 0, metadataUploadEndTime = 0;
    let transactionStartTime = 0, transactionEndTime = 0;
    
    if (!address || !walletClient || !publicClient) {
      throw new Error("Wallet not connected");
    }

    const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
    if (!apiKey) {
      throw new Error("Zora API key not configured");
    }

    setApiKey(apiKey);
    setIsCreating(true);

    try {
      // Ensure we're on Base network
      if (chainId !== base.id) {
        try {
          await switchChain({ chainId: base.id });
        } catch (switchError: any) {
          throw new Error(`Failed to switch to Base network. Please switch manually. Error: ${switchError.message}`);
        }
      }

      // Generate symbol from title
      const generateSymbol = (title: string): string => {
        return title
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .substring(0, 6);
      };

      const symbol = generateSymbol(post.title);

      if (!symbol || symbol.trim().length === 0) {
        throw new Error("Failed to generate symbol for the coin");
      }

      if (!post.title || post.title.trim().length === 0) {
        throw new Error("Post title is required for coin creation");
      }
      const avatarUrl = `https://images.hive.blog/u/${post.author}/avatar/sm`;
      const thumbnailUrl = extractThumbnailFromPost(post);
      
      // Use selected carousel images or extract from markdown
      let markdownImages: string[] = [];
      if (selectedCarouselImages && selectedCarouselImages.length > 0) {
        // Use only the included images from the carousel selection (excluding generated card)
        markdownImages = selectedCarouselImages
          .filter(img => img.isIncluded && !img.isGenerated)
          .map(img => img.uri);
      } else {
        // Fallback to extracting all images from markdown
        markdownImages = extractMarkdownImages(post.body);
      }
      console.log('Using carousel images:', markdownImages);
      console.log('Selected carousel images received:', selectedCarouselImages);
      
      // Extract the generated card from carousel images instead of generating a new one
      const generatedCardItem = selectedCarouselImages?.find(img => img.isGenerated);
      let nftCardImage: File;
      
      console.log('🖼️ Image generation phase starting...');
      imageStartTime = Date.now();
      
      if (generatedCardItem && generatedCardItem.uri.startsWith('blob:')) {
        // Convert blob URL to File object
        try {
          console.log('📁 Converting existing blob to file...');
          const response = await fetch(generatedCardItem.uri);
          const blob = await response.blob();
          nftCardImage = new File([blob], 'generated-card.png', { type: 'image/png' });
          console.log('✅ Using the beautiful generated card from modal preview');
        } catch (error) {
          console.warn('Failed to fetch generated card from blob URL, falling back to generating new card:', error);
          // Fallback to generating new card
          console.log('🎨 Generating new card (fallback)...');
          nftCardImage = await generateMarkdownCoinCard(
            post.title,
            post.author,
            post.body,
            avatarUrl,
            thumbnailUrl || undefined
          );
        }
      } else {
        console.warn('No generated card found in carousel images, generating new card');
        // Fallback to generating new card
        console.log('🎨 Generating new card (no existing card found)...');
        nftCardImage = await generateMarkdownCoinCard(
          post.title,
          post.author,
          post.body,
          avatarUrl,
          thumbnailUrl || undefined
        );
      }
      
      imageEndTime = Date.now();
      console.log(`✅ Image generation completed in ${imageEndTime - imageStartTime}ms`);

      // Extract URLs from selected carousel images (only included ones, excluding generated cards)
      const carouselImageUrls = selectedCarouselImages
        ?.filter(img => img.isIncluded && !img.isGenerated) // Exclude generated cards
        ?.map(img => img.uri) || [];
      
      console.log("🔍 CAROUSEL DEBUG:");
      console.log("- selectedCarouselImages:", selectedCarouselImages);
      console.log("- selectedCarouselImages length:", selectedCarouselImages?.length || 0);
      console.log("- filtered included images:", selectedCarouselImages?.filter(img => img.isIncluded));
      console.log("- filtered non-generated images:", selectedCarouselImages?.filter(img => img.isIncluded && !img.isGenerated));
      console.log("- carouselImageUrls:", carouselImageUrls);
      console.log("- carouselImageUrls length:", carouselImageUrls.length);

      // Validate that we have at least the generated card
      if (!nftCardImage) {
        throw new Error("Failed to generate NFT card image");
      }

      // Create carousel content (card + selected carousel images)
      const carouselContent = await createCarouselContent(nftCardImage, carouselImageUrls);
      console.log('Created carousel content:', carouselContent);
      console.log('Carousel media count:', carouselContent.carousel?.media?.length || 0);

      // Upload markdown content to IPFS
      const markdownBlob = new Blob([post.body], { type: 'text/markdown' });
      const markdownFile = new File([markdownBlob], `${post.permlink}.md`, { type: 'text/markdown' });
      const markdownIpfsUrl = await uploadToIpfs(markdownBlob, `${post.permlink}.md`);
      const cleanMarkdownIpfsUrl = markdownIpfsUrl.split('?')[0]; // Remove query parameters

      if (!markdownIpfsUrl) {
        throw new Error("Failed to upload markdown content to IPFS");
      }

      // Prepare the description with markdown content
      const convertedMarkdown = convertToMarkdown(post.body);
      let description = `${post.title}\n\nBy @${post.author}\n\nOriginal post: ${APP_CONFIG.BASE_URL}/post/${post.author}/${post.permlink}\n\n---\n\n${convertedMarkdown}`;

      // Truncate description if it's too long (some metadata builders have limits)
      const MAX_DESCRIPTION_LENGTH = 2000;
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        description = description.substring(0, MAX_DESCRIPTION_LENGTH - 3) + "...";
        console.log(`Description truncated from ${description.length + 3} to ${description.length} characters`);
      }

      if (!description || description.trim().length === 0) {
        throw new Error("Failed to generate description for the coin");
      }

      // LOG METADATA FORMAT FOR COMPARISON WITH ZORA CAROUSEL EXAMPLE
      console.log("=== ZORA METADATA STRUCTURE ===");
      console.log("Expected Zora format example:", {
        name: post.title,
        ticker: symbol,
        description: description,
        image: "ipfs://...", // This will be nftCardImage after upload
        content: {
          mime: carouselContent.mime || "image/jpeg",
          uri: "ipfs://...", // This will be the same as image
          type: carouselContent.type || "CAROUSEL",
          carousel: carouselContent.carousel
        }
      });
      console.log("Our carousel content structure:", JSON.stringify(carouselContent, null, 2));
      console.log("Selected carousel images:", selectedCarouselImages?.filter(img => img.isIncluded));
      console.log("Carousel image URLs being used:", carouselImageUrls);
      console.log("================================");

      // Always use carousel format (even with just the generated card)
      // Upload the carousel JSON to IPFS first
      console.log('🌐 Starting IPFS uploads...');
      ipfsStartTime = Date.now();
      
      const carouselIpfsUrl = await uploadToIpfs(
        new Blob([JSON.stringify(carouselContent, null, 2)], { type: 'application/json' }), 
        'carousel.json'
      );

      if (!carouselIpfsUrl) {
        throw new Error("Failed to upload carousel content to IPFS");
      }
      
      // Clean the carousel IPFS URL to remove query parameters
      const cleanCarouselIpfsUrl = carouselIpfsUrl.split('?')[0];
      
      ipfsEndTime = Date.now();
      console.log(`✅ IPFS uploads completed in ${ipfsEndTime - ipfsStartTime}ms`);
      debugLog("🎯 COIN CREATION DATA:", {
        "- nftCardImage type": typeof nftCardImage,
        "- nftCardImage instanceof File": nftCardImage instanceof File,
        "- nftCardImage instanceof Blob": nftCardImage instanceof Blob,
        "- cleanCarouselIpfsUrl": cleanCarouselIpfsUrl,
        "- post.title": post.title,
        "- symbol": symbol,
        "- description length": description?.length
      });
      console.log("- description length:", description?.length);
      console.log("================================");

      // VALIDATE REQUIRED FIELDS BEFORE GENERATING METADATA
      if (!post.title || !symbol || !description || !nftCardImage || !cleanCarouselIpfsUrl) {
        const missingFields = [];
        if (!post.title) missingFields.push("post.title");
        if (!symbol) missingFields.push("symbol");
        if (!description) missingFields.push("description");
        if (!nftCardImage) missingFields.push("nftCardImage");
        if (!cleanCarouselIpfsUrl) missingFields.push("cleanCarouselIpfsUrl");

        throw new Error(`Missing required fields for metadata generation: ${missingFields.join(", ")}`);
      }

      // NUCLEAR OPTION: Create metadata manually without the problematic builder
      console.log("🚨 BYPASSING METADATA BUILDER - Creating metadata manually");
      
      let cleanMetadataUrl: string;
      let metadataObject: any;
      
      try {
        // Upload the NFT card image to get clean IPFS URL
        const cardImageIpfsUrl = await uploadToIpfs(nftCardImage, 'nft-card.png');
        const cleanCardImageUrl = cardImageIpfsUrl.split('?')[0];
        
        // Create the metadata object manually in the exact format Zora expects
        const manualMetadata = {
          name: post.title,
          description: description,
          image: `ipfs://${cleanCardImageUrl.replace(`https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/`, '')}`,
          content: carouselContent, // Embed the full carousel structure directly
          properties: {
            content_type: 'longform-post',
            skatehive_post: 'true',
            markdown_ipfs: cleanMarkdownIpfsUrl,
            word_count: post.body.split(/\s+/).filter(w => w.length > 0).length.toString(),
            reading_time: Math.ceil(post.body.split(/\s+/).filter(w => w.length > 0).length / 200).toString(),
            original_author: post.author,
            original_permlink: post.permlink,
            original_url: `${APP_CONFIG.BASE_URL}/post/${post.author}/${post.permlink}`,
            carousel_images: (carouselContent.carousel?.media?.length || 1).toString(),
            has_carousel: carouselContent.carousel ? 'true' : 'false',
            carousel_type: carouselContent.type || 'CAROUSEL',
            carousel_version: carouselContent.carousel?.version || '1.0.0',
            carousel_ipfs: cleanCarouselIpfsUrl,
          }
        };

        console.log("🔍 DETAILED CAROUSEL CONTENT ANALYSIS:");
        console.log("- carouselContent:", JSON.stringify(carouselContent, null, 2));
        console.log("- carouselContent.type:", carouselContent.type);
        console.log("- carouselContent.mime:", carouselContent.mime);
        console.log("- carouselContent.uri:", carouselContent.uri);
        console.log("- carouselContent.carousel:", carouselContent.carousel);
        console.log("- carouselContent.carousel.media length:", carouselContent.carousel?.media?.length);
        console.log("- carouselContent.carousel.media items:");

        console.log("==========================================");
        console.log("🔍 MANUAL METADATA FINAL STRUCTURE:");
        console.log("- manualMetadata.name:", manualMetadata.name);
        console.log("- manualMetadata.image:", manualMetadata.image);
        console.log("- manualMetadata.content:", JSON.stringify(manualMetadata.content, null, 2));
        console.log("- manualMetadata.content.carousel.media length:", manualMetadata.content.carousel?.media?.length);
        console.log("==========================================");

        console.log("✅ Manual metadata created:", JSON.stringify(manualMetadata, null, 2));
        
        // Upload the metadata to IPFS
        console.log('📤 Uploading final metadata to IPFS...');
        metadataUploadStartTime = Date.now();
        
        const metadataBlob = new Blob([JSON.stringify(manualMetadata, null, 2)], { type: 'application/json' });
        const metadataIpfsUrl = await uploadToIpfs(metadataBlob, 'metadata.json');
        cleanMetadataUrl = metadataIpfsUrl.split('?')[0];
        
        metadataUploadEndTime = Date.now();
        console.log(`✅ Metadata uploaded to IPFS in ${metadataUploadEndTime - metadataUploadStartTime}ms:`, cleanMetadataUrl);
        
        // Set the metadata object for use outside the try block
        metadataObject = manualMetadata;
        
      } catch (error) {
        console.log("❌ Manual metadata creation failed:", error);
        throw error;
      }
      console.log("====================================");

      // Use our manual metadata instead of the problematic builder
      const createMetadataParameters = {
        name: post.title,
        symbol: symbol,
        uri: `ipfs://${cleanMetadataUrl.replace(`https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/`, '')}` as `ipfs://${string}`
      };

      // LOG FINAL METADATA PARAMETERS SENT TO ZORA
      console.log("=== FINAL ZORA METADATA PARAMETERS ===");
      console.log("createMetadataParameters:", JSON.stringify(createMetadataParameters, null, 2));
      console.log("=====================================");

      // Create the coin
      console.log('🪙 Creating coin on Zora Protocol...');
      transactionStartTime = Date.now();
      
      const coinParams = {
        name: createMetadataParameters.name,
        symbol: createMetadataParameters.symbol,
        metadata: { type: "RAW_URI" as const, uri: createMetadataParameters.uri },
        creator: address,
        payoutRecipient: address,
        platformReferrer: SKATEHIVE_PLATFORM_REFERRER as `0x${string}`,
        currency: "ZORA" as const,
      };

      const result = await createCoin({
        call: coinParams,
        walletClient,
        publicClient,
        options: { gasMultiplier: 120 },
      });
      
      transactionEndTime = Date.now();
      console.log(`✅ Coin creation transaction completed in ${transactionEndTime - transactionStartTime}ms`);

      if (!result?.address) {
        throw new Error("Failed to get coin address from creation result");
      }

      const coinAddress = result.address;

      const overallEndTime = Date.now();
      const totalTime = overallEndTime - overallStartTime;
      console.log(`🎉 COIN CREATION COMPLETED! Total time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);

      toast({
        title: "Markdown Coin Created!",
        description: `Your longform post "${post.title}" has been minted as a Zora coin!`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      return {
        success: true,
        coinAddress,
        zoraUrl: `https://zora.co/coin/base:${coinAddress}`,
        markdownIpfsUrl,
        transactionHash: result.hash,
        debugInfo: {
          coinParams,
          metadataParameters: createMetadataParameters,
          carouselContent,
          description: convertedMarkdown.substring(0, 500) + "...",
          symbol,
          markdownImages: markdownImages.length,
          hasCarousel: markdownImages.length > 0,
          timing: {
            total: totalTime,
            image: `${imageEndTime - imageStartTime}ms`,
            ipfs: `${ipfsEndTime - ipfsStartTime}ms`,
            metadata: `${metadataUploadEndTime - metadataUploadStartTime}ms`,
            transaction: `${transactionEndTime - transactionStartTime}ms`,
          },
          originalPost: {
            title: post.title,
            author: post.author,
            permlink: post.permlink,
            wordCount: post.body.split(/\s+/).filter(w => w.length > 0).length,
          }
        }
      };

    } catch (error: any) {
      // Don't log the full error to avoid console noise
      console.error("❌ useMarkdownCoin: Creation failed");
      
      // Professional error handling - check for user cancellation
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      const errorCode = error?.code || error?.cause?.code;
      const errorName = error?.name || error?.cause?.name || error?.constructor?.name;
      const errorDetails = error?.details || "";
      
      let toastTitle = "Failed to create coin";
      let toastDescription = "Unknown error occurred";
      
      // User cancelled transaction - ContractFunctionExecutionError detection
      if (
        errorCode === 4001 || 
        errorName === "ContractFunctionExecutionError" ||
        errorMessage.toLowerCase().includes("user rejected") ||
        errorMessage.toLowerCase().includes("user denied") ||
        errorMessage.toLowerCase().includes("user denied transaction signature") ||
        errorMessage.toLowerCase().includes("rejected") ||
        errorMessage.toLowerCase().includes("cancelled") ||
        errorDetails.toLowerCase().includes("user denied") ||
        errorDetails.toLowerCase().includes("user rejected")
      ) {
        toastTitle = "Transaction Cancelled";
        toastDescription = "You cancelled the transaction in your wallet";
      }
      // Insufficient funds or gas
      else if (
        errorMessage.toLowerCase().includes("insufficient funds") ||
        errorMessage.toLowerCase().includes("insufficient balance") ||
        errorMessage.toLowerCase().includes("insufficient gas") ||
        errorMessage.toLowerCase().includes("out of gas") ||
        errorDetails.toLowerCase().includes("insufficient funds") ||
        errorCode === -32000 ||
        errorCode === -32003
      ) {
        toastTitle = "Insufficient Funds";
        toastDescription = "You don't have enough ETH to cover the gas fees";
      }
      // Network issues
      else if (
        errorMessage.toLowerCase().includes("network") ||
        errorMessage.toLowerCase().includes("rpc")
      ) {
        toastTitle = "Network Error";
        toastDescription = "Connection issue. Please check your internet and try again";
      }
      // Generic error - keep it short
      else {
        toastTitle = "Transaction Failed";
        toastDescription = "Something went wrong. Please try again";
      }
      
      toast({
        title: toastTitle,
        description: toastDescription,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [address, walletClient, publicClient, chainId, switchChain, aioha, user, toast]);

  return {
    createMarkdownCoin,
    isCreating,
  };
}
