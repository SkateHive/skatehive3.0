import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import type { ProfileData } from "./ProfilePage";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { KeychainSDK, KeychainKeyTypes, Broadcast } from "keychain-sdk";
import { Operation } from "@hiveio/dhive";
import { mergeHiveProfileMetadata } from "@/lib/hive/profile-metadata";
import { sanitize as sanitizeIgHandle } from "@/lib/instagram/resolveIgHandle";
import { validateBtcAddress, normalizeBtcAddress } from "@/lib/utils/validateBtcAddress";
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
      instagram: "",
      btc_address: "",
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
    const profileInputRef = useRef<HTMLInputElement | null>(null);
    const coverInputRef = useRef<HTMLInputElement | null>(null);

    // Always call hooks at the top level
    const account = useAccount();

    // Safely extract values with fallbacks
    const address = account?.address;
    const isConnected = account?.isConnected || false;

    const { user: aiohaUser } = useAioha();
    const { hiveIdentity } = useLinkedIdentities();
    // Effective Hive user: Keychain/Aioha session, else the Hive identity linked
    // to the userbase (email / sponsored) account. Lets sponsored users edit
    // their profile via the stored posting key without Hive Keychain.
    const user = aiohaUser || hiveIdentity?.handle || null;
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
          instagram: profileData.instagram || "",
          btc_address: profileData.btc_address || "",
        });
        setProfileImageFile(null);
        setCoverImageFile(null);
        setError(null);
      }
    }, [isOpen, profileData]);

    // The DB-stored Instagram handle takes precedence over the Hive metadata
    // value (e.g. user updated via the cross-post dialog but hasn't pushed
    // the change back to Hive yet). Fetch and patch when modal opens.
    useEffect(() => {
      if (!isOpen) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch("/api/userbase/profile/instagram", {
            credentials: "include",
          });
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled) return;
          if (data?.handle) {
            setFormData((prev) => ({ ...prev, instagram: data.handle }));
          }
        } catch {
          // Silent — Hive metadata fallback is already populated.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isOpen]);

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

        // Validate the (optional) Bitcoin address before broadcasting.
        const btcRaw = (formData.btc_address || "").trim();
        if (btcRaw && !validateBtcAddress(btcRaw)) {
          setError("Invalid Bitcoin address");
          return;
        }
        const btcNormalized = btcRaw ? normalizeBtcAddress(btcRaw) : "";

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

        // The profile lives in `posting_json_metadata`, which the POSTING
        // authority can sign. Prefer the user's stored posting key (sponsored /
        // email users) so NO Hive Keychain is required — Keychain is only a
        // fallback for users who sign with their own active key.
        const profilePatch = {
          name: formData.name || username,
          about: formData.about || "",
          location: formData.location || "",
          cover_image: finalCoverImage || "",
          profile_image: finalProfileImage || "",
          website: formData.website || "",
          // Plain username (no @), sanitized. Other Hive frontends can
          // surface this however they like; SkateHive reads it back.
          instagram: sanitizeIgHandle(formData.instagram) || "",
          version: 2,
        };

        let broadcasted = false;
        try {
          const res = await fetch("/api/userbase/hive/account-update", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: profilePatch }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.success) {
            broadcasted = true;
          } else if (res.status === 403) {
            // Soft-post account (no own Hive account yet) — nothing to sign.
            setError(
              data?.error ||
                "You need your own Hive account to edit this profile — get sponsored first."
            );
            return;
          }
          // 401 (no userbase session) / 500 (no stored key) → fall back to Keychain.
        } catch {
          // Network hiccup — fall back to Keychain below.
        }

        // Fallback: sign with the user's own active key via Keychain. This path
        // also writes json_metadata (extensions/wallets), which needs the active
        // authority the stored posting key doesn't have.
        if (!broadcasted) {
          const keychain = new KeychainSDK(window);

          const { jsonMetadata: currentMetadata, postingMetadata } =
            await fetchAccount(username);

          const { postingMetadata: mergedPosting, jsonMetadata: mergedJson } =
            mergeHiveProfileMetadata({
              currentPosting: postingMetadata,
              currentJson: currentMetadata,
              profilePatch,
              extensionsPatch: {
                wallets: {
                  primary_wallet: profileData.ethereum_address || "",
                  btc_address: btcNormalized,
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
        }

        // Mirror the Instagram handle into userbase_identities so the IG
        // cross-post resolver can read it without a Hive RPC roundtrip.
        // Failure here is non-fatal: the Hive metadata write already
        // succeeded and the resolver will fall back to it.
        const sanitizedIg = sanitizeIgHandle(formData.instagram);
        try {
          if (sanitizedIg) {
            await fetch("/api/userbase/profile/instagram", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ handle: sanitizedIg, source: "edit_profile" }),
            });
          } else {
            await fetch("/api/userbase/profile/instagram", {
              method: "DELETE",
              credentials: "include",
            });
          }
        } catch {
          // ignore — Hive write is the source of truth
        }

        // Mirror the BTC address into userbase_identities (type='btc') so the
        // DB stays in sync with Hive metadata. Non-fatal like the IG mirror.
        try {
          if (btcNormalized) {
            await fetch("/api/userbase/profile/btc", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: btcNormalized, source: "edit_profile" }),
            });
          } else {
            await fetch("/api/userbase/profile/btc", {
              method: "DELETE",
              credentials: "include",
            });
          }
        } catch {
          // ignore — Hive write is the source of truth
        }

        // Update parent component with new data
        const updatedData = {
          ...formData,
          instagram: sanitizedIg || "",
          btc_address: btcNormalized,
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
            onClick={() => profileInputRef.current?.click()}
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
                      onClick={() => profileInputRef.current?.click()}
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
                      ref={profileInputRef}
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
                      onClick={() => coverInputRef.current?.click()}
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
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverImageChange}
                      display="none"
                    />
                  </Flex>
                </FormControl>

                {EthereumWalletSection}

                <FormControl
                  isInvalid={
                    !!formData.btc_address.trim() &&
                    !validateBtcAddress(formData.btc_address)
                  }
                >
                  <FormLabel>Bitcoin Address</FormLabel>
                  <Input
                    value={formData.btc_address}
                    onChange={handleFormChange("btc_address")}
                    placeholder="bc1... / 1... / 3..."
                    fontFamily="mono"
                    size="sm"
                  />
                  {!!formData.btc_address.trim() &&
                    !validateBtcAddress(formData.btc_address) && (
                      <Text fontSize="xs" color="red.400" mt={1}>
                        That doesn&apos;t look like a valid Bitcoin address.
                      </Text>
                    )}
                </FormControl>

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
                  <Flex gap={2} align="center">
                    <FormLabel mb={0} minWidth="80px">
                      Instagram
                    </FormLabel>
                    <Input
                      value={formData.instagram}
                      onChange={handleFormChange("instagram")}
                      placeholder="yourighandle"
                      flex={1}
                    />
                  </Flex>
                  <Text fontSize="xs" color="gray.500" mt={1} ml="88px">
                    Used to @-tag you in @skatehive Instagram cross-posts. No @ needed.
                  </Text>
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
          outputMaxDimension={1300}
          outputFileName="magazine-cover.jpg"
          title="Crop Magazine Cover"
        />
      </>
    );
  }
);

EditProfile.displayName = "EditProfile";

export default EditProfile;
