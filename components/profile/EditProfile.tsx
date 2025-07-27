import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
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
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useAioha } from "@aioha/react-ui";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { KeychainSDK, KeychainKeyTypes, Broadcast } from "keychain-sdk";
import { Operation } from "@hiveio/dhive";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import MergeAccountModal from "./MergeAccountModal";

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
    });
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const { user } = useAioha();
    const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
      useFarcasterSession();
    const [isEditingEthAddress, setIsEditingEthAddress] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
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
        });
        setProfileImageFile(null);
        setCoverImageFile(null);
        setError(null);
      }
    }, [isOpen, profileData]);

    useEffect(() => {
      if (isOpen && (isConnected || isFarcasterConnected)) {
        setShowMergeModal(true);
      }
    }, [isOpen, isConnected, isFarcasterConnected]);

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

    const uploadToIPFS = useCallback(
      async (file: File): Promise<string | null> => {
        const formDataForUpload = new FormData();
        formDataForUpload.append("file", file);
        try {
          const response = await fetch("/api/pinata", {
            method: "POST",
            body: formDataForUpload,
          });
          if (!response.ok) throw new Error("Failed to upload file to IPFS");
          const result = await response.json();
          return result.IpfsHash
            ? `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`
            : null;
        } catch (err) {
          setError("Image upload failed");
          return null;
        }
      },
      []
    );

    // Check if user wants to update their Ethereum address
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
      if (!user || user !== username || (!isConnected && !isFarcasterConnected)) {
        setShowMergeModal(false);
        return;
      }

      try {
        const accountResp = await fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_accounts",
            params: [[username]],
            id: 1,
          }),
        }).then((res) => res.json());

        if (!accountResp.result || accountResp.result.length === 0) {
          throw new Error("Account not found");
        }

        let currentMetadata: any = {};
        let postingMetadata: any = {};
        try {
          if (accountResp.result[0].json_metadata) {
            currentMetadata = JSON.parse(accountResp.result[0].json_metadata);
          }
        } catch (error) {
          console.log("No existing metadata or invalid JSON");
        }
        try {
          if (accountResp.result[0].posting_json_metadata) {
            postingMetadata = JSON.parse(
              accountResp.result[0].posting_json_metadata
            );
          }
        } catch {
          postingMetadata = {};
        }

        const migrated = migrateLegacyMetadata(currentMetadata);
        migrated.extensions = migrated.extensions || {};
        migrated.extensions.wallets = migrated.extensions.wallets || {};
        if (isConnected && address) {
          migrated.extensions.wallets.primary_wallet = address;
        }

        if (isFarcasterConnected && farcasterProfile) {
          migrated.extensions.farcaster = migrated.extensions.farcaster || {};
          migrated.extensions.farcaster.username = farcasterProfile.username;
          migrated.extensions.farcaster.fid = farcasterProfile.fid;
          if (farcasterProfile.pfpUrl) {
            migrated.extensions.farcaster.pfp_url = farcasterProfile.pfpUrl;
            postingMetadata.profile = postingMetadata.profile || {};
            postingMetadata.profile.profile_image = farcasterProfile.pfpUrl;
          }
          if (farcasterProfile.bio) {
            migrated.extensions.farcaster.bio = farcasterProfile.bio;
            postingMetadata.profile = postingMetadata.profile || {};
            postingMetadata.profile.about = farcasterProfile.bio;
          }
          if (farcasterProfile.custody) {
            migrated.extensions.wallets.custody_address = farcasterProfile.custody;
          }
          if (
            Array.isArray(farcasterProfile.verifications) &&
            farcasterProfile.verifications.length > 0
          ) {
            migrated.extensions.wallets.farcaster_verified_wallets =
              farcasterProfile.verifications;
          }
        }

        const operation: Operation = [
          "account_update2",
          {
            account: username,
            json_metadata: JSON.stringify(migrated),
            posting_json_metadata: JSON.stringify(postingMetadata),
            extensions: [],
          },
        ];

        const keychain = new KeychainSDK(window);
        const formParams = {
          data: {
            username: username,
            operations: [operation],
            method: KeychainKeyTypes.active,
          },
        };

        const result = await keychain.broadcast(formParams.data as any);

        if (!result) {
          throw new Error("Merge failed");
        }

        const updatedData: Partial<ProfileData> = {};
        if (address) updatedData.ethereum_address = address;
        if (farcasterProfile?.pfpUrl) updatedData.profileImage = farcasterProfile.pfpUrl;
        if (farcasterProfile?.bio) updatedData.about = farcasterProfile.bio;
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
        setShowMergeModal(false);
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

      try {
        // Check if user is logged in
        if (!user) {
          setError("Please log in to update your profile");
          return;
        }

        if (user !== username) {
          setError("You can only edit your own profile");
          return;
        }

        // Upload images if files are selected
        if (profileImageFile) {
          const url = await uploadToIPFS(profileImageFile);
          if (url) finalProfileImage = url;
        }
        if (coverImageFile) {
          const url = await uploadToIPFS(coverImageFile);
          if (url) finalCoverImage = url;
        }

        // Use Keychain SDK for the update
        const keychain = new KeychainSDK(window);

        const profileMetadata = {
          profile: {
            name: formData.name || username,
            about: formData.about || "",
            location: formData.location || "",
            cover_image: finalCoverImage || "",
            profile_image: finalProfileImage || "",
            website: formData.website || "",
            version: 2,
          },
        };

        const accountResp = await fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_accounts",
            params: [[username]],
            id: 1,
          }),
        }).then((res) => res.json());

        if (!accountResp.result || accountResp.result.length === 0) {
          throw new Error("Account not found");
        }

        let currentMetadata: any = {};
        try {
          if (accountResp.result[0].json_metadata) {
            currentMetadata = JSON.parse(accountResp.result[0].json_metadata);
          }
        } catch (error) {
          console.log("No existing metadata or invalid JSON");
        }

        const migrated = migrateLegacyMetadata(currentMetadata);
        migrated.extensions = migrated.extensions || {};
        migrated.extensions.wallets = migrated.extensions.wallets || {};
        migrated.extensions.wallets.primary_wallet = profileData.ethereum_address || "";
        migrated.extensions.video_parts = profileData.video_parts || [];

        const extMetadata = migrated;

        const formParamsAsObject = {
          data: {
            username: username,
            operations: [
              [
                "account_update2",
                {
                  account: username,
                  json_metadata: JSON.stringify(extMetadata),
                  posting_json_metadata: JSON.stringify(profileMetadata),
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
      uploadToIPFS,
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

              {/* Custom wallet connection instead of ConnectButton */}
              {!isConnected ? (
                <VStack spacing={2} align="stretch">
                  {connectors.map((connector) => (
                    <Button
                      key={connector.id}
                      onClick={() => connect({ connector })}
                      isLoading={isPending}
                      loadingText="Connecting..."
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                    >
                      Connect {connector.name}
                    </Button>
                  ))}
                </VStack>
              ) : (
                <VStack spacing={2} align="stretch">
                  <Text fontSize="sm" fontWeight="medium" color="green.500">
                    ✓ Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                  </Text>
                  <Flex gap={2}>
                    <Button
                      size="sm"
                      colorScheme="green"
                      onClick={handleConnectEthWallet}
                      flex={1}
                    >
                      {hasEthAddress ? "Update Address" : "Link Address"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disconnect()}
                    >
                      Disconnect
                    </Button>
                  </Flex>
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
              <>
                <Text
                  fontSize="sm"
                  fontFamily="mono"
                  bg="gray.100"
                  _dark={{ bg: "gray.700" }}
                  p={2}
                  borderRadius="md"
                  wordBreak="break-all"
                >
                  {profileData.ethereum_address}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditEthAddress}
                >
                  Change Wallet
                </Button>
              </>
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
      connectors,
      isPending,
      connect,
      disconnect,
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

          <Box
            position="absolute"
            top="4"
            left="4"
            bg="blackAlpha.700"
            color="white"
            px="3"
            py="1"
            borderRadius="md"
            fontSize="sm"
            fontWeight="semibold"
          >
            Edit Profile
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
          <ModalCloseButton
            color="white"
            bg="blackAlpha.700"
            _hover={{ bg: "blackAlpha.800" }}
          />
          <ModalBody mt="40px">
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Profile Picture</FormLabel>
                <VStack spacing={2} align="stretch">
                  <Input
                    value={profileImageFile ? "" : formData.profileImage}
                    onChange={handleProfileImageUrlChange}
                    placeholder="Paste image URL here"
                    size="sm"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      document.getElementById("profilePictureInput")?.click()
                    }
                  >
                    Upload from Device
                  </Button>
                  <Input
                    id="profilePictureInput"
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    display="none"
                  />
                </VStack>
              </FormControl>

              <FormControl>
                <FormLabel>Cover Image</FormLabel>
                <VStack spacing={2} align="stretch">
                  <Input
                    value={coverImageFile ? "" : formData.coverImage}
                    onChange={handleCoverImageUrlChange}
                    placeholder="Paste image URL here"
                    size="sm"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      document.getElementById("backgroundImageInput")?.click()
                    }
                  >
                    Upload from Device
                  </Button>
                  <Input
                    id="backgroundImageInput"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageChange}
                    display="none"
                  />
                </VStack>
              </FormControl>

              {EthereumWalletSection}

              <FormControl>
                <FormLabel>Location</FormLabel>
                <Select
                  value={formData.location}
                  onChange={handleFormChange("location")}
                  placeholder="Select your country"
                >
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value} - {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>
                  Website - a clickable link to your personal website
                </FormLabel>
                <Input
                  value={formData.website}
                  onChange={handleFormChange("website")}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Words to live by? (optional)</FormLabel>
                <Textarea
                  value={formData.about}
                  onChange={handleFormChange("about")}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
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
      </ModalFooter>
    </ModalContent>
      </Modal>
      <MergeAccountModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onMerge={handleMergeAccounts}
      />
      </>
    );
  }
);

EditProfile.displayName = "EditProfile";

export default EditProfile;
