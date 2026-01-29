import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Image,
  VStack,
  Box,
  Select,
  Text,
  Flex,
  useToast,
} from "@chakra-ui/react";
import countryList from "react-select-country-list";
import { ProfileData } from "./ProfilePage";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAioha } from "@aioha/react-ui";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { KeychainSDK, KeychainKeyTypes, Broadcast } from "keychain-sdk";
import { Operation } from "@hiveio/dhive";
import { mergeHiveProfileMetadata } from "@/lib/hive/profile-metadata";
import MergeAccountModal from "./MergeAccountModal";
import fetchAccount from "@/lib/hive/fetchAccount";
import {
  mergeAccounts,
  generateMergePreview,
} from "@/lib/services/mergeAccounts";
import { ProfileDiff } from "@/lib/utils/profileDiff";

import { uploadToIpfs } from "@/lib/markdown/composeUtils";
import ImageCropper from "../shared/ImageCropper";
interface EditProfileProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: ProfileData;
  onProfileUpdate: (data: Partial<ProfileData>) => void;
  username: string;
}

const EditProfile: React.FC<EditProfileProps> = React.memo(
  (props: EditProfileProps) => {
    const { isOpen, onClose, profileData, onProfileUpdate, username } = props;

    const [formData, setFormData] = useState({
      name: "",
      about: "",
      location: "",
      website: "",
      profileImage: "",
      coverImage: "",
      zineCover: "",
      svs_profile: "",
    });
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditingEthAddress, setIsEditingEthAddress] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [profileDiff, setProfileDiff] = useState<ProfileDiff | undefined>();
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(
      null
    );

    // Always call hooks at the top level
    const account = useAccount();

    // Safely extract values with fallbacks
    const address = account?.address;
    const isConnected = account?.isConnected || false;

    const { user } = useAioha();
    const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
      useFarcasterSession();
    const toast = useToast();

    const countryOptions = useMemo(() => countryList().getData(), []);

    // Reset form data when modal opens or profileData changes
    useEffect(() => {
      if (isOpen) {
        setFormData({
          name: profileData.name || "",
          about: profileData.about || "",
          location: profileData.location || "",
          website: profileData.website || "",
          profileImage: profileData.profileImage || "",
          coverImage: profileData.coverImage || "",
          zineCover: profileData.zineCover || "",
          svs_profile: profileData.svs_profile || "",
        });
        setProfileImageFile(null);
        setCoverImageFile(null);
        setError(null);
      }
    }, [isOpen, profileData]);

    const generatePreview = useCallback(async () => {
      if (!user || user !== username) return;

      setIsGeneratingPreview(true);
      try {
        const options: any = {
          username: username,
        };

        if (isConnected && address) {
          options.ethereumAddress = address;
        }

        if (isFarcasterConnected && farcasterProfile) {
          options.farcasterProfile = {
            fid: farcasterProfile.fid,
            username: farcasterProfile.username,
            custody: farcasterProfile.custody,
            verifications: farcasterProfile.verifications,
          };
        }

        const diff = await generateMergePreview(options);
        setProfileDiff(diff);
      } catch (err: any) {
        console.error("Failed to generate merge preview", err);
        toast({
          title: "Preview Failed",
          description: err?.message || "Unable to generate preview",
          status: "error",
          duration: 3000,
        });
      } finally {
        setIsGeneratingPreview(false);
      }
    }, [
      user,
      username,
      isConnected,
      address,
      isFarcasterConnected,
      farcasterProfile,
      toast,
    ]);

    useEffect(() => {
      if (isOpen && (isConnected || isFarcasterConnected)) {
        // Check if user already has an Ethereum wallet in their metadata
        const hasExistingEthWallet =
          profileData.ethereum_address &&
          profileData.ethereum_address.trim() !== "";

        // Only show merge modal if user doesn't already have an Ethereum wallet
        if (!hasExistingEthWallet) {
          setShowMergeModal(true);
          generatePreview();
        }
      }
    }, [
      isOpen,
      isConnected,
      isFarcasterConnected,
      profileData.ethereum_address,
      generatePreview,
    ]);

    // Memoized form field handlers
    const handleFormChange = useCallback(
      (field: string) =>
        (
          e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >
        ) => {
          setFormData((prev) => ({ ...prev, [field]: e.target.value }));
        },
      []
    );

    const handleProfileImageChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          setProfileImageFile(file);
          setFormData((prev) => ({
            ...prev,
            profileImage: URL.createObjectURL(file),
          }));
        }
      },
      []
    );

    const handleCoverImageChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          setCoverImageFile(file);
          setFormData((prev) => ({
            ...prev,
            coverImage: URL.createObjectURL(file),
          }));
        }
      },
      []
    );

    const handleProfileImageUrlChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, profileImage: e.target.value }));
        setProfileImageFile(null);
      },
      []
    );

    const handleCoverImageUrlChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, coverImage: e.target.value }));
        setCoverImageFile(null);
      },
      []
    );

    const handleZineCoverChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          // Open cropper with the selected image
          const reader = new FileReader();
          reader.onload = () => {
            setTempImageForCrop(reader.result as string);
            setIsCropperOpen(true);
          };
          reader.readAsDataURL(file);
        }
      },
      []
    );

    const handleCropComplete = useCallback(
      async (croppedFile: File) => {
        try {
          // Upload to IPFS immediately
          const ipfsUrl = await uploadToIpfs(croppedFile, croppedFile.name);

          // Update form data with the IPFS URL
          setFormData((prev) => ({
            ...prev,
            zineCover: ipfsUrl,
          }));

          // Close the cropper modal
          setIsCropperOpen(false);
          setTempImageForCrop(null);

          toast({
            title: "Magazine cover uploaded",
            description: "Your custom cover has been uploaded successfully.",
            status: "success",
            duration: 3000,
          });
        } catch (error) {
          console.error("Failed to upload magazine cover:", error);
          toast({
            title: "Upload failed",
            description: "Failed to upload magazine cover. Please try again.",
            status: "error",
            duration: 3000,
          });
        }
      },
      [toast]
    );

    const handleZineCoverUrlChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, zineCover: e.target.value }));
      },
      []
    );

    const handleConnectEthWallet = useCallback(() => {
      if (isConnected && address) {
        const updatedData = {
          ...profileData,
          ethereum_address: address,
        };
        onProfileUpdate(updatedData);
        setIsEditingEthAddress(false);
      }
    }, [isConnected, address, profileData, onProfileUpdate]);

    const handleEditEthAddress = useCallback(() => {
      setIsEditingEthAddress(true);
    }, []);

    const handleCancelEthEdit = useCallback(() => {
      setIsEditingEthAddress(false);
    }, []);

    const handleMergeAccounts = useCallback(async () => {
      if (
        !user ||
        user !== username ||
        (!isConnected && !isFarcasterConnected)
      ) {
        setShowMergeModal(false);
        return;
      }

      setIsMerging(true);
      try {
        const options: any = {
          username: username,
        };

        if (isConnected && address) {
          options.ethereumAddress = address;
        }

        if (isFarcasterConnected && farcasterProfile) {
          options.farcasterProfile = {
            fid: farcasterProfile.fid,
            username: farcasterProfile.username,
            custody: farcasterProfile.custody,
            verifications: farcasterProfile.verifications,
          };
        }

        const result = await mergeAccounts(options);

        const updatedData: Partial<ProfileData> = {};
        if (address) updatedData.ethereum_address = address;
        onProfileUpdate(updatedData);

        toast({
          title: "Wallet Linked",
          status: "success",
          duration: 3000,
        });
      } catch (err: any) {
        console.error("Failed to merge account data", err);
        toast({
          title: "Merge Failed",
          description: err?.message || "Unable to update account",
          status: "error",
          duration: 3000,
        });
      } finally {
        setIsMerging(false);
        setShowMergeModal(false);
        setProfileDiff(undefined);
      }
    }, [
      address,
      isConnected,
      isFarcasterConnected,
      farcasterProfile,
      user,
      username,
      onProfileUpdate,
      toast,
    ]);

    // Update handleSave to use Keychain SDK directly
    const handleSave = useCallback(async () => {
      setIsSaving(true);
      setError(null);

      let finalProfileImage = formData.profileImage;
      let finalCoverImage = formData.coverImage;
      let finalZineCover = formData.zineCover;

      try {
        // Check if user is logged in
        if (!user) {
          setError("Connect your Hive wallet (Keychain) to save changes");
          return;
        }

        if (user !== username) {
          setError("Connect your Hive account to edit this profile");
          return;
        }

        // Upload images if files are selected
        if (profileImageFile) {
          const url = await uploadToIpfs(
            profileImageFile,
            profileImageFile.name
          );
          if (url) finalProfileImage = url;
        }
        if (coverImageFile) {
          const url = await uploadToIpfs(coverImageFile, coverImageFile.name);
          if (url) finalCoverImage = url;
        }
        // zineCover is already uploaded to IPFS in handleCropComplete

        // Use Keychain SDK for the update
        const keychain = new KeychainSDK(window);

        const { jsonMetadata: currentMetadata, postingMetadata } =
          await fetchAccount(username);

        const { postingMetadata: mergedPosting, jsonMetadata: mergedJson } =
          mergeHiveProfileMetadata({
            currentPosting: postingMetadata,
            currentJson: currentMetadata,
            profilePatch: {
              name: formData.name || username,
              about: formData.about || "",
              location: formData.location || "",
              cover_image: finalCoverImage || "",
              profile_image: finalProfileImage || "",
              website: formData.website || "",
              version: 2,
            },
            extensionsPatch: {
              wallets: {
                primary_wallet: profileData.ethereum_address || "",
              },
              video_parts: profileData.video_parts || [],
              settings: {
                appSettings: {
                  zineCover: finalZineCover || "",
                  svs_profile: formData.svs_profile || "",
                },
              },
            },
          });

        const formParamsAsObject = {
          data: {
            username: username,
            operations: [
              [
                "account_update2",
                {
                  account: username,
                  json_metadata: JSON.stringify(mergedJson),
                  posting_json_metadata: JSON.stringify(mergedPosting),
                  extensions: [],
                },
              ],
            ],
            method: KeychainKeyTypes.active,
          },
        };

        const result = await keychain.broadcast(
          formParamsAsObject.data as unknown as Broadcast
        );

        if (!result) {
          throw new Error("Profile update failed");
        }

        // Update parent component with new data
        const updatedData = {
          ...formData,
          profileImage: finalProfileImage,
          coverImage: finalCoverImage,
          zineCover: finalZineCover,
          ethereum_address: profileData.ethereum_address,
          video_parts: profileData.video_parts,
        };

        onProfileUpdate(updatedData);
        onClose();
      } catch (err: any) {
        // Handle specific errors
        if (
          err.message?.includes("user_cancel") ||
          err.message?.includes("cancelled")
        ) {
          setError("Profile update was cancelled");
        } else if (err.message?.includes("insufficient")) {
          setError("Insufficient resource credits to update profile");
        } else if (err.message?.includes("serialize")) {
          setError("Transaction serialization failed. Please try again.");
        } else {
          setError(err.message || "Failed to update profile");
        }
      } finally {
        setIsSaving(false);
      }
    }, [
      formData,
      profileImageFile,
      coverImageFile,
      profileData.ethereum_address,
      profileData.video_parts,
      onProfileUpdate,
      username,
      onClose,
      user,
    ]);

    // Memoized Ethereum wallet section
    const EthereumWalletSection = useMemo(() => {
      const hasEthAddress =
        profileData.ethereum_address && profileData.ethereum_address.length > 0;

      if (isEditingEthAddress) {
        return (
          <FormControl>
            <FormLabel>Connect Ethereum Wallet</FormLabel>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="gray.500">
                {hasEthAddress
                  ? "Connect a new wallet to update your Ethereum address"
                  : "Connect your Ethereum wallet to link it with your Hive profile"}
              </Text>

              {/* Use RainbowKit ConnectButton */}
              <Box>
                <ConnectButton
                  showBalance={false}
                  chainStatus="none"
                  accountStatus={{
                    smallScreen: "avatar",
                    largeScreen: "full",
                  }}
                />
              </Box>

              {isConnected && address && (
                <VStack spacing={2} align="stretch">
                  <Text fontSize="sm" fontWeight="medium" color="green.500">
                    ✓ Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                  </Text>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={handleConnectEthWallet}
                  >
                    {hasEthAddress ? "Update Address" : "Link Address"}
                  </Button>
                </VStack>
              )}

              <Button size="sm" variant="ghost" onClick={handleCancelEthEdit}>
                Cancel
              </Button>
            </VStack>
          </FormControl>
        );
      }

      return (
        <FormControl>
          <FormLabel>Ethereum Wallet</FormLabel>
          <VStack spacing={2} align="stretch">
            {hasEthAddress ? (
              <Flex gap={2}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditEthAddress}
                >
                  Change
                </Button>
                <Text
                  fontSize="sm"
                  fontFamily="mono"
                  bg="gray.100"
                  _dark={{ bg: "gray.700" }}
                  p={2}
                  borderRadius="none"
                  wordBreak="break-all"
                  flex={1}
                >
                  {profileData.ethereum_address}
                </Text>
              </Flex>
            ) : (
              <>
                <Text fontSize="sm" color="gray.500">
                  No Ethereum wallet connected
                </Text>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleEditEthAddress}
                >
                  Connect Ethereum Wallet
                </Button>
              </>
            )}
          </VStack>
        </FormControl>
      );
    }, [
      profileData.ethereum_address,
      isEditingEthAddress,
      isConnected,
      address,
      handleConnectEthWallet,
      handleEditEthAddress,
      handleCancelEthEdit,
    ]);

    // Memoized modal header
    const ModalHeaderContent = useMemo(
      () => (
        <ModalHeader p={0} position="relative" minHeight="120px">
          {formData.coverImage ? (
            <Image
              src={formData.coverImage}
              alt="Cover Preview"
              width="100%"
              height="120px"
              objectFit="cover"
              borderTopRadius="md"
            />
          ) : (
            <Box
              width="100%"
              height="120px"
              bg="gray.200"
              _dark={{ bg: "gray.600" }}
              borderTopRadius="md"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
              fontSize="sm"
            >
              Cover Image Preview
            </Box>
          )}

          <Box
            position="absolute"
            bottom="-30px"
            left="50%"
            transform="translateX(-50%)"
            borderRadius="full"
            border="4px solid white"
            _dark={{ borderColor: "gray.800" }}
            bg="white"
            cursor="pointer"
            _hover={{ opacity: 0.8 }}
            transition="opacity 0.2s"
            onClick={() =>
              document.getElementById("profilePictureInput")?.click()
            }
          >
            {formData.profileImage ? (
              <Image
                src={formData.profileImage}
                alt="Profile Preview"
                boxSize="60px"
                borderRadius="full"
                objectFit="cover"
              />
            ) : (
              <Box
                boxSize="60px"
                borderRadius="full"
                bg="gray.200"
                _dark={{ bg: "gray.600" }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="gray.500"
                fontSize="xs"
              >
                Profile
              </Box>
            )}
          </Box>
        </ModalHeader>
      ),
      [formData.coverImage, formData.profileImage]
    );

    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
          <ModalOverlay blur={"lg"} />
          <ModalContent bg={"background"}>
            {ModalHeaderContent}

            <ModalBody mt="40px">
              <VStack spacing={4} align="stretch">
                {error && (
                  <Box color="red.400" mb={2} w="100%">
                    {error}
                  </Box>
                )}
                <Button
                  colorScheme="green"
                  onClick={handleSave}
                  w="100%"
                  isLoading={isSaving}
                  loadingText="Saving..."
                >
                  Save Changes
                </Button>
                <FormControl>
                  <FormLabel>Profile Picture</FormLabel>
                  <Flex gap={2}>
                    <Button
                      size="sm"
                      onClick={() =>
                        document.getElementById("profilePictureInput")?.click()
                      }
                    >
                      Upload
                    </Button>
                    <Input
                      value={profileImageFile ? "" : formData.profileImage}
                      onChange={handleProfileImageUrlChange}
                      placeholder="Paste image URL here"
                      size="sm"
                      flex={1}
                    />
                    <Input
                      id="profilePictureInput"
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      display="none"
                    />
                  </Flex>
                </FormControl>

                <FormControl>
                  <FormLabel>Profile Background</FormLabel>
                  <Flex gap={2}>
                    <Button
                      size="sm"
                      onClick={() =>
                        document.getElementById("backgroundImageInput")?.click()
                      }
                    >
                      Upload
                    </Button>
                    <Input
                      value={coverImageFile ? "" : formData.coverImage}
                      onChange={handleCoverImageUrlChange}
                      placeholder="Paste image URL here"
                      size="sm"
                      flex={1}
                    />
                    <Input
                      id="backgroundImageInput"
                      type="file"
                      accept="image/*"
                      onChange={handleCoverImageChange}
                      display="none"
                    />
                  </Flex>
                </FormControl>

                {EthereumWalletSection}

                <FormControl>
                  <Flex gap={2} align="center">
                    <FormLabel mb={0} minWidth="80px">
                      Location
                    </FormLabel>
                    <Select
                      value={formData.location}
                      onChange={handleFormChange("location")}
                      placeholder="Select your country"
                      flex={1}
                    >
                      {countryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value} - {option.label}
                        </option>
                      ))}
                    </Select>
                  </Flex>
                </FormControl>

                <FormControl>
                  <Flex gap={2} align="center">
                    <FormLabel mb={0} minWidth="80px">
                      Website
                    </FormLabel>
                    <Input
                      value={formData.website}
                      onChange={handleFormChange("website")}
                      flex={1}
                    />
                  </Flex>
                </FormControl>

                <FormControl>
                  <FormLabel>Words to live by? (optional)</FormLabel>
                  <Textarea
                    value={formData.about}
                    onChange={handleFormChange("about")}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Mag Cover (optional)</FormLabel>
                  <Flex gap={2}>
                    <Button
                      size="sm"
                      colorScheme="green"
                      onClick={() =>
                        document.getElementById("zineCoverInput")?.click()
                      }
                    >
                      Upload
                    </Button>
                    <Input
                      value={formData.zineCover}
                      onChange={handleZineCoverUrlChange}
                      placeholder="Paste image URL here"
                      size="sm"
                      flex={1}
                    />
                    <Input
                      id="zineCoverInput"
                      type="file"
                      accept="image/*"
                      onChange={handleZineCoverChange}
                      display="none"
                    />
                  </Flex>
                </FormControl>

                <FormControl>
                  <FormLabel>SVS Profile (optional)</FormLabel>
                  <Input
                    value={formData.svs_profile}
                    onChange={handleFormChange("svs_profile")}
                    placeholder="Enter your SVS profile information"
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter></ModalFooter>
          </ModalContent>
        </Modal>
        <MergeAccountModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false);
            setProfileDiff(undefined);
          }}
          onMerge={handleMergeAccounts}
          profileDiff={profileDiff}
          isLoading={isGeneratingPreview || isMerging}
        />
        <ImageCropper
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false);
            setTempImageForCrop(null);
          }}
          imageSrc={tempImageForCrop || ""}
          onCropComplete={handleCropComplete}
          aspectRatio={1000 / 1300}
          title="Crop Magazine Cover"
        />
      </>
    );
  }
);

EditProfile.displayName = "EditProfile";

export default EditProfile;
