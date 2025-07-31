import { useState, useCallback } from 'react';
import { createCoin, DeployCurrency, createMetadataBuilder, createZoraUploaderForCreator, setApiKey } from '@zoralabs/coins-sdk';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { useToast } from '@chakra-ui/react';
import { SKATEHIVE_PLATFORM_REFERRER } from '@/components/shared/search/constants';
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Operation } from "@hiveio/dhive";
import { updatePostWithCoinInfo } from "@/lib/hive/server-actions";

// Utility function to generate thumbnail from video file
const generateVideoThumbnail = async (videoFile: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.onloadedmetadata = () => {
      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Seek to 1 second (or 10% of video duration, whichever is smaller)
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      // Draw the current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const thumbnailFile = new File([blob], `${videoFile.name}_thumbnail.jpg`, {
            type: 'image/jpeg'
          });
          resolve(thumbnailFile);
        } else {
          reject(new Error('Failed to generate thumbnail blob'));
        }
      }, 'image/jpeg', 0.8);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    // Load the video
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};

export interface CoinCreationData {
  name: string;
  symbol: string;
  description: string;
  image?: File;
  mediaUrl?: string;
  mediaFile?: File;
  animationUrl?: string; // For video content
  postAuthor?: string;
  postPermlink?: string;
  postBody: string;
  postJsonMetadata: string;
  postTitle: string;
  postParentAuthor: string;
  postParentPermlink: string;
}

export function useCoinCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { aioha, user } = useAioha();
  const toast = useToast();

  const createCoinFromPost = useCallback(async (coinData: CoinCreationData) => {
    if (!address || !walletClient || !publicClient) {
      throw new Error('Wallet not connected');
    }

    const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
    if (!apiKey) {
      throw new Error('Zora API key not configured');
    }

    // Set the API key globally for the Zora SDK
    setApiKey(apiKey);

    setIsCreating(true);
    try {
      // Create metadata using Zora's metadata builder
      const metadataBuilder = createMetadataBuilder()
        .withName(coinData.name)
        .withSymbol(coinData.symbol)
        .withDescription(coinData.description);

      // Add media - prioritize direct files (including videos) then URLs
      if (coinData.mediaFile) {
        const fileType = coinData.mediaFile.type;
        const isVideo = fileType.startsWith("video/");
        const isImage = fileType.startsWith("image/");

        if (isVideo) {
          // For videos, use withMedia() which sets animation_url
          metadataBuilder.withMedia(coinData.mediaFile);
          
          try {
            // Auto-generate thumbnail for video
            const thumbnail = await generateVideoThumbnail(coinData.mediaFile);
            metadataBuilder.withImage(thumbnail);
          } catch (thumbnailError) {
            console.warn('Failed to generate video thumbnail:', thumbnailError);
            // Continue without thumbnail - video will still work
          }
          
        } else if (isImage) {
          // For images, use the standard image method
          metadataBuilder.withImage(coinData.mediaFile);
        } else {
          console.warn('Unsupported file type:', fileType);
          // Try to add as media anyway as fallback
          metadataBuilder.withMedia(coinData.mediaFile);
        }
      } else if (coinData.mediaUrl && coinData.mediaUrl.trim()) {
        // For URLs (including IPFS URLs), we need to fetch and convert to File for the metadata builder
        try {
          const response = await fetch(coinData.mediaUrl);
          const blob = await response.blob();
          // Use actual content type from response
          const contentType = blob.type || 'application/octet-stream';
          const isImage = contentType.startsWith('image/');
          const isVideo = contentType.startsWith('video/');
          
          if (isVideo) {
            // Handle video from URL
            const filename = 'coin-video.mp4';
            const file = new File([blob], filename, { type: contentType });
            metadataBuilder.withMedia(file);
            
            // Try to generate thumbnail for video from URL
            try {
              const thumbnail = await generateVideoThumbnail(file);
              metadataBuilder.withImage(thumbnail);
            } catch (thumbnailError) {
              console.warn('Failed to generate thumbnail for video from URL:', thumbnailError);
            }
          } else if (isImage) {
            // This should be our thumbnail from IPFS for video coins, or regular image for image coins
            const filename = coinData.mediaUrl.includes('thumbnail') ? 'coin-thumbnail.jpg' : 'coin-image.jpg';
            const file = new File([blob], filename, { type: contentType });
            metadataBuilder.withImage(file);
          } else {
            console.warn('Unsupported media type from URL:', contentType);
          }
        } catch (error) {
          console.warn('Failed to fetch media URL for coin image:', error);
          // Continue without image
        }
      } else if (coinData.image) {
        // Use image file directly (legacy support for direct file uploads)
        metadataBuilder.withImage(coinData.image);
      }

      const { createMetadataParameters } = await metadataBuilder
        .upload(createZoraUploaderForCreator(address));

      // Create the coin
      const coinParams = {
        ...createMetadataParameters,
        payoutRecipient: address,
        platformReferrer: SKATEHIVE_PLATFORM_REFERRER as Address,
        currency: DeployCurrency.ZORA, // Use ZORA as the trading currency
      };

      const result = await createCoin(coinParams, walletClient, publicClient, {
        gasMultiplier: 120, // Add 20% buffer to gas
      });

      // Check if the coin creator is the same as the post author OR if this was posted server-side
      const isPostAuthor = user && coinData.postAuthor && user.toLowerCase() === coinData.postAuthor.toLowerCase();
      const isServerSidePost = !user && coinData.postAuthor === (process.env.NEXT_PUBLIC_HIVE_USER || 'skatedev');
      
      if ((isPostAuthor || isServerSidePost) && result.address) {
        try {
          // Generate Zora URL for the coin
          const zoraUrl = `https://zora.co/coin/base:${result.address}`;
          
          if (isPostAuthor && aioha) {
            // User created the post and coin - update via Aioha
            const updatedBody = `${coinData.postBody}\n\n---\n \n ${zoraUrl}`;
            
            // Parse and update metadata
            let updatedMetadata: any = {};
            try {
              updatedMetadata = JSON.parse(coinData.postJsonMetadata || '{}');
            } catch (e) {
              console.warn('Failed to parse post metadata, using empty object');
            }
            
            // Add zora_coin_address to metadata
            updatedMetadata.zora_coin_address = result.address;
            updatedMetadata.zora_coin_url = zoraUrl;
            
            // Create edit operation with correct parent information
            const operation: Operation = [
              'comment',
              {
                parent_author: coinData.postParentAuthor || '',
                parent_permlink: coinData.postParentPermlink || '',
                author: coinData.postAuthor!,
                permlink: coinData.postPermlink!,
                title: coinData.postTitle || '',
                body: updatedBody,
                json_metadata: JSON.stringify(updatedMetadata),
              },
            ];

            // Broadcast the edit using Aioha
            const editResult = await aioha.signAndBroadcastTx([operation], KeyTypes.Posting);
            
            if (editResult && !editResult.error) {
              toast({
                title: 'Post updated with Zora coin!',
                description: 'Your post has been updated to include the coin collection link.',
                status: 'success',
                duration: 5000,
                isClosable: true,
              });
            } else {
              throw new Error('Failed to broadcast post update via Aioha');
            }
          } else if (isServerSidePost) {
            // Post was created server-side - update via server action
            const updateResult = await updatePostWithCoinInfo({
              author: coinData.postAuthor!,
              permlink: coinData.postPermlink!,
              coinAddress: result.address,
              coinUrl: zoraUrl,
            });
            
            if (updateResult.success) {
              toast({
                title: 'Post updated with Zora coin!',
                description: 'Your post has been updated to include the coin collection link.',
                status: 'success',
                duration: 5000,
                isClosable: true,
              });
            } else {
              throw new Error(updateResult.error || 'Failed to update post via server action');
            }
          }
        } catch (postEditError) {
          console.error('Failed to update post with coin link:', postEditError);
          toast({
            title: 'Coin created but post update failed',
            description: 'Your coin was created successfully, but we couldn\'t update the post automatically.',
            status: 'warning',
            duration: 7000,
            isClosable: true,
          });
        }
      }

      const successMessage = isPostAuthor || isServerSidePost 
        ? `Your coin "${coinData.name}" has been deployed and the post has been updated!`
        : `Your coin "${coinData.name}" has been deployed!`;

      toast({
        title: 'Coin created successfully!',
        description: successMessage,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      return {
        hash: result.hash,
        address: result.address,
        deployment: result.deployment,
      };

    } catch (error: any) {
      console.error('Failed to create coin:', error);
      
      toast({
        title: 'Failed to create coin',
        description: error.message || 'An error occurred while creating the coin',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [address, walletClient, publicClient, user, aioha, toast]);

  return {
    createCoinFromPost,
    createCoin: createCoinFromPost, // Alias for backward compatibility
    isCreating,
  };
}
