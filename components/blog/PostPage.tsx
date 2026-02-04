// app/page.tsx
"use client";

import { Alert, AlertDescription, AlertIcon, Box, Flex, Spinner } from "@chakra-ui/react";
import SnapList from "../homepage/SnapList";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Discussion } from "@hiveio/dhive"; // Ensure this import is consistent
import Conversation from "../homepage/Conversation";
import SnapReplyModal from "../homepage/SnapReplyModal";
import { getPost } from "@/lib/hive/client-functions";
import PostDetails from "@/components/blog/PostDetails";
import { useComments } from "@/hooks/useComments";
import InitFrameSDK from "@/hooks/init-frame-sdk";
import BountyDetail from "@/components/bounties/BountyDetail";
import ContentErrorWatcher from "@/components/shared/ContentErrorWatcher";
import { getDeletedPostKeys } from "@/lib/utils/softDelete";

interface PostPageProps {
  author: string;
  permlink: string;
}

export default function PostPage({ author, permlink }: PostPageProps) {
  // Add InitFrameSDK at the top so it runs on mount
  InitFrameSDK();

  const [isLoading, setIsLoading] = useState(false);
  const [post, setPost] = useState<Discussion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Discussion | undefined>();
  const [reply, setReply] = useState<Discussion>();
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState<Discussion | null>(null); // Define the state

  const data = useComments(author, permlink, true);
  const commentsData = useMemo(
    () => ({
      ...data,
      loadNextPage: () => {},
      hasMore: false,
    }),
    [data]
  );

  useEffect(() => {
    async function loadPost() {
      setIsLoading(true);
      try {
        const deletedKeys = await getDeletedPostKeys();
        const postKey = `${author}/${permlink}`.toLowerCase();
        if (deletedKeys.has(postKey)) {
          setError("Post not found");
          setPost(null);
          return;
        }

        const post = await getPost(author, permlink);
        setPost(post);
      } catch (err) {
        setError("Failed to load post");
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [author, permlink]);

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);

  const handleNewComment = useCallback(
    (newComment: Partial<Discussion> | CharacterData) => {
      setNewComment(newComment as Discussion); // Type assertion
    },
    []
  );

  // Memoize bounty detection
  const isBounty = useMemo(() => {
    return post?.body && post.body.includes("Trick/Challenge:");
  }, [post?.body]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (error || !post || !author || !permlink) {
    return (
      <Box p={4}>
        <Alert status="warning">
          <AlertIcon />
          <AlertDescription>{error || "Post not found"}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  // Detect if this is a bounty post
  if (isBounty) {
    return (
      <ContentErrorWatcher>
        <BountyDetail post={post} />
      </ContentErrorWatcher>
    );
  }

  return (
    <ContentErrorWatcher>
      <Box bg="background" color="text" minH="100vh">
        <Flex
          direction={{ base: "column", md: "row" }}
          h={{ base: "auto", md: "100vh" }}
          gap={4}
        >
          <Box
            flex={1}
            h={{ base: "auto", md: "100vh" }}
            overflowY="auto"
            sx={{
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            <PostDetails post={post} onOpenConversation={onOpen} />
          </Box>
          <Box
            width={{ base: "100%", md: "35%" }}
            h={{ base: "auto", md: "100vh" }}
            overflowY="auto"
            sx={{ "&::-webkit-scrollbar": { display: "none" } }}
          >
            {!conversation ? (
              <>
                <SnapList
                  author={author}
                  permlink={permlink}
                  setConversation={setConversation}
                  onOpen={onOpen}
                  setReply={setReply}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  post={true}
                  data={commentsData}
                />
              </>
            ) : (
              <Conversation
                discussion={conversation}
                setConversation={setConversation}
                onOpen={onOpen}
                setReply={setReply}
              />
            )}
          </Box>
        </Flex>
        {isOpen && (
          <SnapReplyModal
            isOpen={isOpen}
            onClose={onClose}
            discussion={reply}
            onNewReply={handleNewComment}
          />
        )}
      </Box>
    </ContentErrorWatcher>
  );
}
