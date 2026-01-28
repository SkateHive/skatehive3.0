"use client";

import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  VStack,
  Avatar,
  Box,
  Text,
  useToast,
  FormErrorMessage,
  HStack,
  IconButton,
  Flex,
  Icon,
} from "@chakra-ui/react";
import { FiCamera, FiMapPin, FiUser, FiAtSign, FiFileText, FiImage } from "react-icons/fi";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { uploadToIpfs } from "@/lib/markdown/composeUtils";
import SkateModal from "@/components/shared/SkateModal";

interface EditUserbaseProfileProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: {
    display_name?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
    bio?: string | null;
    location?: string | null;
  };
  onProfileUpdate?: () => void;
}

export default function EditUserbaseProfile({
  isOpen,
  onClose,
  profileData,
  onProfileUpdate,
}: EditUserbaseProfileProps) {
  const { refresh } = useUserbaseAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    display_name: "",
    handle: "",
    avatar_url: "",
    cover_url: "",
    bio: "",
    location: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        display_name: profileData.display_name || "",
        handle: profileData.handle || "",
        avatar_url: profileData.avatar_url || "",
        cover_url: profileData.cover_url || "",
        bio: profileData.bio || "",
        location: profileData.location || "",
      });
      setHandleError(null);
    }
  }, [isOpen, profileData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "handle") {
      setHandleError(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const url = await uploadToIpfs(file, file.name);
      setFormData((prev) => ({ ...prev, avatar_url: url }));
      toast({
        title: "Avatar uploaded",
        status: "success",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Failed to upload avatar",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const url = await uploadToIpfs(file, file.name);
      setFormData((prev) => ({ ...prev, cover_url: url }));
      toast({
        title: "Cover image uploaded",
        status: "success",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Failed to upload cover image",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setHandleError(null);

    try {
      const response = await fetch("/api/userbase/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: formData.display_name || null,
          handle: formData.handle || null,
          avatar_url: formData.avatar_url || null,
          cover_url: formData.cover_url || null,
          bio: formData.bio || null,
          location: formData.location || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setHandleError("This handle is already taken");
          return;
        }
        throw new Error(data.error || "Failed to update profile");
      }

      toast({
        title: "Profile updated",
        status: "success",
        duration: 2000,
      });

      // Refresh auth context to get updated user data
      await refresh();
      onProfileUpdate?.();
      onClose();
    } catch (error) {
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      size="md"
      isCentered
      footer={
        <HStack spacing={3} justify="flex-end" w="full">
          <Button
            variant="ghost"
            onClick={onClose}
            color="text"
            fontFamily="mono"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Cancel
          </Button>
          <Button
            bg="primary"
            color="background"
            border="2px solid"
            borderColor="primary"
            fontFamily="mono"
            textTransform="uppercase"
            letterSpacing="wider"
            _hover={{
              bg: "transparent",
              color: "primary",
              borderColor: "primary",
            }}
            _active={{ bg: "primary", color: "background" }}
            onClick={handleSave}
            isLoading={isSaving}
            isDisabled={isUploadingAvatar || isUploadingCover}
          >
            Save
          </Button>
        </HStack>
      }
    >
      <VStack spacing={4} align="stretch" px={4} py={3}>
        {/* Cover Image Section */}
        <Box position="relative" mb={10}>
          <Box
            h="120px"
            bg={formData.cover_url ? "transparent" : "blackAlpha.400"}
            borderRadius="sm"
            overflow="hidden"
            border="1px solid"
            borderColor="whiteAlpha.200"
          >
            {formData.cover_url ? (
              <Box
                as="img"
                src={formData.cover_url}
                alt="Cover"
                w="100%"
                h="100%"
                objectFit="cover"
              />
            ) : (
              <Flex h="100%" align="center" justify="center">
                <VStack spacing={1}>
                  <Icon as={FiImage} color="dim" boxSize={6} />
                  <Text fontSize="xs" color="dim" fontFamily="mono">
                    Cover Image
                  </Text>
                </VStack>
              </Flex>
            )}
          </Box>
          <Input
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            display="none"
            id="cover-upload"
          />
          <IconButton
            as="label"
            htmlFor="cover-upload"
            aria-label="Upload cover"
            icon={<FiCamera />}
            size="sm"
            position="absolute"
            bottom={2}
            right={2}
            bg="blackAlpha.700"
            color="white"
            _hover={{ bg: "blackAlpha.800" }}
            isLoading={isUploadingCover}
            cursor="pointer"
            borderRadius="sm"
          />

          {/* Avatar overlapping cover */}
          <Box position="absolute" bottom={-10} left="50%" transform="translateX(-50%)">
            <Box position="relative">
              <Avatar
                size="2xl"
                src={formData.avatar_url}
                name={formData.display_name || formData.handle || "User"}
                border="2px solid"
                borderColor="primary"
                bg="panel"
              />
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                display="none"
                id="avatar-upload"
              />
              <IconButton
                as="label"
                htmlFor="avatar-upload"
                aria-label="Upload avatar"
                icon={<FiCamera />}
                size="xs"
                position="absolute"
                bottom={1}
                right={1}
                bg="primary"
                color="background"
                _hover={{ bg: "accent" }}
                isLoading={isUploadingAvatar}
                cursor="pointer"
                borderRadius="sm"
              />
            </Box>
          </Box>
        </Box>

        {/* Display Name */}
        <FormControl>
          <FormLabel
            color="text"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            fontFamily="mono"
          >
            <Icon as={FiUser} />
            Display Name
          </FormLabel>
          <Input
            name="display_name"
            value={formData.display_name}
            onChange={handleInputChange}
            placeholder="Your display name"
            bg="blackAlpha.400"
            color="text"
            borderColor="whiteAlpha.200"
            borderRadius="sm"
            fontFamily="mono"
            _placeholder={{ color: "gray.600" }}
            _focus={{
              borderColor: "primary",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
            }}
          />
        </FormControl>

        {/* Handle */}
        <FormControl isInvalid={!!handleError}>
          <FormLabel
            color="text"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            fontFamily="mono"
          >
            <Icon as={FiAtSign} />
            Handle
          </FormLabel>
          <Input
            name="handle"
            value={formData.handle}
            onChange={handleInputChange}
            placeholder="your-handle"
            bg="blackAlpha.400"
            color="text"
            borderColor="whiteAlpha.200"
            borderRadius="sm"
            fontFamily="mono"
            _placeholder={{ color: "gray.600" }}
            _focus={{
              borderColor: "primary",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
            }}
          />
          {handleError ? (
            <FormErrorMessage fontFamily="mono">{handleError}</FormErrorMessage>
          ) : (
            <Text fontSize="2xs" color="dim" mt={1} fontFamily="mono">
              This will be your unique @handle for your profile URL
            </Text>
          )}
        </FormControl>

        {/* Bio */}
        <FormControl>
          <FormLabel
            color="text"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            fontFamily="mono"
          >
            <Icon as={FiFileText} />
            Bio
          </FormLabel>
          <Textarea
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            placeholder="Tell us about yourself..."
            rows={3}
            bg="blackAlpha.400"
            color="text"
            borderColor="whiteAlpha.200"
            borderRadius="sm"
            fontFamily="mono"
            _placeholder={{ color: "gray.600" }}
            _focus={{
              borderColor: "primary",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
            }}
            resize="none"
          />
        </FormControl>

        {/* Location */}
        <FormControl>
          <FormLabel
            color="text"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            fontFamily="mono"
          >
            <Icon as={FiMapPin} />
            Location
          </FormLabel>
          <Input
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Your location"
            bg="blackAlpha.400"
            color="text"
            borderColor="whiteAlpha.200"
            borderRadius="sm"
            fontFamily="mono"
            _placeholder={{ color: "gray.600" }}
            _focus={{
              borderColor: "primary",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
            }}
          />
        </FormControl>
      </VStack>
    </SkateModal>
  );
}
