import {
  Box,
  VStack,
  useDisclosure,
  Text,
  useToast,
  Flex,
  IconButton,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { memo, useCallback } from "react";
import { VideoPart } from "@/types/VideoPart";
import VideoPartCard from "./VideoPartCard";
import VideoPartsForm from "./VideoPartsForm";
import type { ProfileData } from "./ProfilePage";
import { updateProfile } from "@/lib/hive/client-functions";

interface VideoPartsViewProps {
  profileData: ProfileData;
  username: string;
  onProfileUpdate: (data: Partial<ProfileData>) => void;
}

const VideoPartsView = memo(function VideoPartsView({
  profileData,
  username,
  onProfileUpdate,
}: VideoPartsViewProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isOwner = profileData.name === username;
  const toast = useToast();

  const updateVideoParts = useCallback(
    async (newVideoParts: VideoPart[]) => {
      try {
        await updateProfile(
          username,
          profileData.name,
          profileData.about,
          profileData.location,
          profileData.coverImage,
          profileData.profileImage,
          profileData.website,
          profileData.ethereum_address,
          newVideoParts
        );

        toast({
          title: "Success",
          description: "Video parts updated!",
          status: "success",
          duration: 5000,
          isClosable: true,
        });

        onProfileUpdate({ video_parts: newVideoParts });
      } catch (error) {
        console.error("Error updating profile", error);
        toast({
          title: "Error",
          description: "Failed to update video parts.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [
      username,
      profileData.name,
      profileData.about,
      profileData.location,
      profileData.coverImage,
      profileData.profileImage,
      profileData.website,
      profileData.ethereum_address,
      toast,
      onProfileUpdate,
    ]
  );

  const handleNewVideoPart = useCallback(
    async (videoPart: VideoPart) => {
      const newVideoParts = [
        ...((profileData.video_parts as unknown as VideoPart[]) || []),
        videoPart,
      ];
      await updateVideoParts(newVideoParts);
    },
    [profileData.video_parts, updateVideoParts]
  );

  const handleRemoveVideoPart = useCallback(
    async (index: number) => {
      const newVideoParts = (
        (profileData.video_parts as unknown as VideoPart[]) || []
      ).filter((_, i) => i !== index);
      await updateVideoParts(newVideoParts);
    },
    [profileData.video_parts, updateVideoParts]
  );

  return (
    <Box>
      {isOwner && (
        <Flex justifyContent="flex-end" mb={4}>
          <IconButton
            aria-label="Add video part"
            icon={<AddIcon />}
            onClick={onOpen}
          />
        </Flex>
      )}
      <VideoPartsForm
        isOpen={isOpen}
        onClose={onClose}
        onNewVideoPart={handleNewVideoPart}
      />
      <VStack spacing={4}>
        {profileData.video_parts && profileData.video_parts.length > 0 ? (
          (profileData.video_parts as unknown as VideoPart[]).map(
            (part, index) => (
              <VideoPartCard
                key={index}
                videoPart={part}
                onRemove={() => handleRemoveVideoPart(index)}
                isOwner={isOwner}
              />
            )
          )
        ) : (
          <Text>No video parts submitted yet.</Text>
        )}
      </VStack>
    </Box>
  );
});

export default VideoPartsView;
