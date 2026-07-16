import {
  Image,
  MenuItem,
  useClipboard,
  useToast,
  useDisclosure,
} from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { FaTwitter, FaLink, FaThumbsDown, FaCode, FaFacebook } from "react-icons/fa";
import React, { useMemo, useCallback } from "react";
import { useFarcasterContext } from "@/hooks/useFarcasterContext";
import useHiveVote from "@/hooks/useHiveVote";
import { isSpotPost } from "@/lib/utils/parseSpotBody";

// Lazy load heavy modals
const DevMetadataDialog = dynamic(() => import("./DevMetadataDialog"), { ssr: false });

// Minimal interface for what we need for sharing
interface ShareablePost {
  author: string;
  permlink: string;
  title?: string;
  body?: string;
  parent_author?: string;
  parent_permlink?: string;
  json_metadata?:
  | string
  | {
    image?: string[];
    [key: string]: any;
  };
}

// Custom Farcaster Icon Component
const FarcasterIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.24 0.24H5.76C2.5789 0.24 0 2.8188 0 6v12c0 3.1811 2.5789 5.76 5.76 5.76h12.48c3.1812 0 5.76 -2.5789 5.76 -5.76V6C24 2.8188 21.4212 0.24 18.24 0.24m0.8155 17.1662v0.504c0.2868 -0.0256 0.5458 0.1905 0.5439 0.479v0.5688h-5.1437v-0.5688c-0.0019 -0.2885 0.2576 -0.5047 0.5443 -0.479v-0.504c0 -0.22 0.1525 -0.402 0.358 -0.458l-0.0095 -4.3645c-0.1589 -1.7366 -1.6402 -3.0979 -3.4435 -3.0979 -1.8038 0 -3.2846 1.3613 -3.4435 3.0979l-0.0096 4.3578c0.2276 0.0424 0.5318 0.2083 0.5395 0.4648v0.504c0.2863 -0.0256 0.5457 0.1905 0.5438 0.479v0.5688H4.3915v-0.5688c-0.0019 -0.2885 0.2575 -0.5047 0.5438 -0.479v-0.504c0 -0.2529 0.2011 -0.4548 0.4536 -0.4724v-7.895h-0.4905L4.2898 7.008l2.6405 -0.0005V5.0419h9.9495v1.9656h2.8219l-0.6091 2.0314h-0.4901v7.8949c0.2519 0.0177 0.453 0.2195 0.453 0.4724" />
  </svg>
);

interface ShareMenuButtonsProps {
  comment: ShareablePost;
}

const ShareMenuButtons = ({ comment }: ShareMenuButtonsProps) => {
  // Memoize the post link to prevent unnecessary re-computations.
  // Skate spots get their own dedicated /spot URL so the share opens
  // the rich spot page (with mini-map + gallery) instead of the generic post view.
  const postLink = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isSpot = isSpotPost({
      body: comment.body,
      json_metadata: comment.json_metadata as any,
    });
    const path = isSpot ? "spot" : "post";
    return `${origin}/${path}/${comment.author}/${comment.permlink}`;
  }, [comment.author, comment.permlink, comment.body, comment.json_metadata]);

  const { onCopy } = useClipboard(postLink);
  const toast = useToast();
  const { isInFrame, composeCast } = useFarcasterContext();
  const { vote, canVote } = useHiveVote();

  // Dev metadata dialog - only used in development
  const {
    isOpen: isMetadataOpen,
    onOpen: onMetadataOpen,
    onClose: onMetadataClose,
  } = useDisclosure();

  const handleDownvote = useCallback(async () => {
    if (!canVote) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to downvote.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const voteResult = await vote(
        comment.author,
        comment.permlink,
        -10000 // 100% downvote (negative value)
      );

      if (voteResult.success) {
        toast({
          title: "Downvote submitted!",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error("Vote failed");
      }
    } catch (error) {
      toast({
        title: "Failed to downvote",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [vote, comment.author, comment.permlink, toast, canVote]);

  const handleShare = useCallback(
    async (platform: string) => {
      if (platform === "copy") {
        onCopy();
        toast({
          title: "URL copied to clipboard!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Handle Farcaster sharing with SDK when in frame context
      if (platform === "farcaster" && isInFrame) {
        try {
          await composeCast(
            `Check out this post from @${comment.author}!`,
            [postLink] // URL as embed, not in text
          );
          toast({
            title: "Cast created successfully!",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
          return;
        } catch (error) {
          console.error("Failed to create cast:", error);
          toast({
            title: "Failed to create cast",
            description: "Falling back to web sharing",
            status: "warning",
            duration: 3000,
            isClosable: true,
          });
          // Fall through to web sharing if SDK fails
        }
      }

      // Handle web sharing for other platforms or fallback
      let shareUrl = "";
      if (platform === "x") {
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
          postLink
        )}`;
      } else if (platform === "facebook") {
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          postLink
        )}`;
      } else if (platform === "farcaster") {
        // For web fallback, include both text and URL
        const castText = `Check out this post from @${comment.author}! ${postLink}`;
        shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
          castText
        )}`;
      }

      if (shareUrl) {
        window.open(shareUrl, "_blank");
      }
    },
    [postLink, isInFrame, composeCast, toast, comment.author, onCopy]
  );

  // Validate permlink to prevent [object Object] URLs
  if (typeof comment.permlink !== "string") {
    console.error(
      "🚨 ShareMenuButtons: Invalid permlink type:",
      typeof comment.permlink
    );
    return null; // Prevent rendering with invalid data
  }

  return (
    <>
      <MenuItem
        onClick={() => handleShare("farcaster")}
        bg={"background"}
        color={"primary"}
      >
        <FarcasterIcon size={16} />
        <span style={{ marginLeft: "8px" }}>
          {isInFrame ? "Cast" : "Share on Farcaster"}
        </span>
      </MenuItem>
      <MenuItem
        onClick={() => handleShare("x")}
        bg={"background"}
        color={"primary"}
      >
        <FaTwitter style={{ marginRight: "8px" }} />
        Share on X
      </MenuItem>
      <MenuItem
        onClick={() => handleShare("facebook")}
        bg={"background"}
        color={"#1877F2"}
      >
        <FaFacebook style={{ marginRight: "8px" }} />
        Share on Facebook
      </MenuItem>
      <MenuItem
        onClick={() => handleShare("copy")}
        bg={"background"}
        color={"primary"}
      >
        <FaLink style={{ marginRight: "8px" }} />
        Copy Link
      </MenuItem>{" "}
      <MenuItem
        onClick={() =>
          window.open(
            `https://peakd.com/@${comment.author}/${comment.permlink}`,
            "_blank"
          )
        }
        bg={"background"}
        color={"primary"}
      >
        <Image
          src="/logos/peakd.png"
          alt="Peakd Logo"
          boxSize="16px"
          mr={2}
          display="inline-block"
        />
        Open in Peakd
      </MenuItem>
      <MenuItem onClick={handleDownvote} bg={"background"} color={"red"}>
        <FaThumbsDown style={{ marginRight: "8px" }} />
        Downvote Post
      </MenuItem>
      {/* Dev Metadata Menu Item - only in development */}
      {process.env.NODE_ENV === "development" && (
        <MenuItem
          onClick={onMetadataOpen}
          bg={"background"}
          color={"purple.400"}
        >
          <FaCode style={{ marginRight: "8px" }} />
          [DEV] Metadata
        </MenuItem>
      )}
      {/* Dev Metadata Dialog - only renders in development */}
      <DevMetadataDialog
        isOpen={isMetadataOpen}
        onClose={onMetadataClose}
        comment={comment}
      />
    </>
  );
};

export default ShareMenuButtons;
