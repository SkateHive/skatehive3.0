"use client";

import { Flex, Box } from "@chakra-ui/react";
import SnapList from "@/components/homepage/SnapList";
import RightSidebar from "@/components/layout/RightSideBar";
import { useState } from "react";
import { Discussion } from "@hiveio/dhive";
import Conversation from "@/components/homepage/Conversation";
import SnapReplyModal from "@/components/homepage/SnapReplyModal";
import { useSnaps } from "@/hooks/useSnaps";
import useIsMobile from "@/hooks/useIsMobile";
import { useRouter } from "next/navigation";
import { HIVE_CONFIG } from "@/config/app.config";

export default function HomePageClient() {
  const thread_author = HIVE_CONFIG.THREADS.AUTHOR;
  const thread_permlink = HIVE_CONFIG.THREADS.PERMLINK;
  const isMobile = useIsMobile();
  const router = useRouter();

  const [conversation, setConversation] = useState<Discussion | undefined>();
  const [reply, setReply] = useState<Discussion>();
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState<Discussion | null>(null);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleNewComment = (
    newComment: Partial<Discussion> | CharacterData
  ) => {
    setNewComment(newComment as Discussion);
  };

  // Handle conversation navigation
  // Show conversation drawer on both desktop and mobile
  const handleSetConversation = (discussion: Discussion | undefined) => {
    setConversation(discussion);
  };

  const snaps = useSnaps();

  return (
    <Flex direction={{ base: "column", md: "row" }} justifyContent="center">
      <Box
        maxH="100vh"
        overflowY="auto"
        width={{ base: "100%", md: "600px", lg: "600px" }}
        maxWidth="600px"
        borderLeft="1px"
        borderRight="1px"
        borderColor="muted"
        p={0}
        pt={2}
        justifyContent="center"
        sx={{
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
        }}
        id="scrollableDiv"
      >
        {/* Always show SnapList */}
        <SnapList
          author={thread_author}
          permlink={thread_permlink}
          setConversation={handleSetConversation}
          onOpen={onOpen}
          setReply={setReply}
          newComment={newComment}
          setNewComment={setNewComment}
          data={snaps}
        />

        {/* Conversation drawer - show on all devices when conversation exists */}
        {conversation && (
          <Conversation
            discussion={conversation}
            setConversation={setConversation}
            onOpen={onOpen}
            setReply={setReply}
            isOpen={!!conversation}
          />
        )}
      </Box>

      <Box display={{ base: "none", md: "block", lg: "block" }}>
        <RightSidebar />
      </Box>
      {isOpen && (
        <SnapReplyModal
          isOpen={isOpen}
          onClose={onClose}
          discussion={reply}
          onNewReply={handleNewComment}
        />
      )}
    </Flex>
  );
}
