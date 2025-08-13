"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  HStack,
  Button,
  Box,
  Text,
} from "@chakra-ui/react";
import { ArrowBackIcon, CheckIcon } from "@chakra-ui/icons";
import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { tokenDictionary } from "@/lib/utils/tokenDictionary";
import { useAirdropManager } from "@/hooks/useAirdropManager";
import { useTransactionStatus } from "@/hooks/useTransactionStatus";
import useIsMobile from "@/hooks/useIsMobile";
import { executeHiveAirdrop } from "@/services/hiveAirdrop";
import { ERC20AirdropService } from "@/services/erc20Airdrop";
import {
  createAirdropAnnouncement,
  generateAnnouncementContent,
} from "../../services/airdropAnnouncement";
import { captureAirdropNetworkScreenshot } from "@/lib/utils/screenshotCapture";
import { SortOption } from "@/types/airdrop";
import { useAioha } from "@aioha/react-ui";
import { PortfolioProvider } from "@/contexts/PortfolioContext";
import {
  TokenSelectionStep,
  ConfigurationStep,
  PreviewStep,
  AnnouncementPreviewStep,
  ConfirmationStep,
} from "./steps";
import { StepHeader } from "./steps/StepHeader";
import { SkaterData } from "@/types/leaderboard";

type ModalView =
  | "tokenSelection"
  | "configuration"
  | "preview"
  | "announcementPreview"
  | "confirmation";

interface AirdropModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardData: SkaterData[];
  initialSortOption?: SortOption;
}

const erc20Service = new ERC20AirdropService();

export function AirdropModal({
  isOpen,
  onClose,
  leaderboardData,
  initialSortOption = "points",
}: AirdropModalProps) {
  // Modal view state
  const [currentView, setCurrentView] = useState<ModalView>("tokenSelection");
  const [currentStep, setCurrentStep] = useState(1);

  // Airdrop configuration
  const [sortOption, setSortOption] = useState<SortOption>(initialSortOption);
  const [limit, setLimit] = useState(10);
  // Set default token and amount based on wallet connection
  const isMobile = useIsMobile();
  // Wallet connections
  const { user, aioha } = useAioha();
  const { address: ethereumAddress, isConnected: isEthereumConnected } =
    useAccount();
  const isHiveConnected = !!user;

  // Determine default token and amount
  let defaultToken = "HIGHER";
  let defaultAmount = "1000";
  if (isHiveConnected && !isEthereumConnected) {
    defaultToken = "HIVE";
    defaultAmount = "10";
  }
  const [selectedToken, setSelectedToken] = useState(defaultToken);
  const [totalAmount, setTotalAmount] = useState(defaultAmount);
  const [customMessage, setCustomMessage] = useState("");
  const [includeSkateHive, setIncludeSkateHive] = useState(false);
  const [isWeightedAirdrop, setIsWeightedAirdrop] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // UI state
  const [isExecuting, setIsExecuting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [networkScreenshot, setNetworkScreenshot] = useState<string>("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  // Hooks
  const { airdropUsers, userCount, validation } = useAirdropManager({
    leaderboardData,
    config: {
      sortOption,
      limit,
      selectedToken,
      totalAmount,
      customMessage,
      enablePreviews: false,
      confirmationRequired: true,
      includeSkateHive,
      isWeightedAirdrop,
    },
  });

  const { status, updateStatus, resetStatus } = useTransactionStatus();

  // Auto-close modal when transaction is completed
  useEffect(() => {
    if (status.state === "completed") {
      // Add a small delay to show the completion message before closing
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    } else if (status.state === "failed") {
      // Close modal on failure with a longer delay so users can read the error
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status.state, onClose]);

  // Computed values
  const getAvailableTokens = () => {
    const allTokens = Object.entries(tokenDictionary);

    // If both wallets connected, show all tokens
    if (isHiveConnected && isEthereumConnected) {
      return allTokens;
    }

    // If only Hive connected, show only Hive tokens
    if (isHiveConnected && !isEthereumConnected) {
      return allTokens.filter(([_, info]) => info.network === "hive");
    }

    // If only Ethereum connected, show only Base/Ethereum tokens
    if (!isHiveConnected && isEthereumConnected) {
      return allTokens.filter(([_, info]) => info.network === "base");
    }

    // If no wallets connected, show all tokens (they'll see connection warnings later)
    return allTokens;
  };

  const tokenOptions = getAvailableTokens().map(([symbol, info]) => ({
    value: symbol,
    label: `${symbol} (${info.network === "hive" ? "Hive" : "Base"})`,
    disabled: false,
  }));

  const selectedTokenInfo = tokenDictionary[selectedToken];
  const isHiveToken = selectedTokenInfo?.network === "hive";

  // Handlers
  const handleConfigChange = useCallback(
    (updates: {
      sortOption?: SortOption;
      limit?: number;
      selectedToken?: string;
      totalAmount?: string;
    }) => {
      if (updates.sortOption !== undefined) setSortOption(updates.sortOption);
      if (updates.limit !== undefined) setLimit(updates.limit);
      if (updates.selectedToken !== undefined)
        setSelectedToken(updates.selectedToken);
      if (updates.totalAmount !== undefined)
        setTotalAmount(updates.totalAmount);
      setCostEstimate(null); // Reset cost estimate when config changes
      if (updates.totalAmount === "")
        setTotalAmount("0");
    },
    []
  );

  const handleClose = useCallback(() => {
    setCurrentView("tokenSelection");
    setCurrentStep(1);
    onClose();
  }, [onClose]);

  const handleEstimateCost = useCallback(async () => {
    if (!validation.isValid || airdropUsers.length === 0) return;

    setIsEstimating(true);
    try {
      const tokenInfo = tokenDictionary[selectedToken];

      if (tokenInfo?.network === "hive") {
        // For Hive tokens, cost estimation is simpler
        const perUser = parseFloat(totalAmount) / airdropUsers.length;
        setCostEstimate({
          totalAmount: totalAmount,
          perUserAmount: perUser,
          canExecute: perUser >= 0.001,
          errors: perUser < 0.001 ? ["Amount per user too small"] : [],
          network: "hive",
        });
      } else {
        // For ERC-20 tokens, use the service
        const estimate = await erc20Service.estimateAirdropCost(
          selectedToken,
          airdropUsers,
          totalAmount
        );
        setCostEstimate({ ...estimate, network: "base" });
      }
    } catch (error) {
    } finally {
      setIsEstimating(false);
    }
  }, [selectedToken, totalAmount, airdropUsers, validation.isValid]);

  const handleExecuteAirdrop = async () => {
    if (!validation.isValid || isExecuting) return;

    setIsExecuting(true);
    resetStatus();

    try {
      const tokenInfo = tokenDictionary[selectedToken];

      if (tokenInfo?.network === "hive") {
        // Execute Hive airdrop
        await executeHiveAirdrop({
          token: selectedToken,
          recipients: airdropUsers,
          totalAmount: parseFloat(totalAmount),
          customMessage:
            customMessage ||
            `SkateHive Community Airdrop - ${selectedToken} 🛹`,
          user: user, // Pass username string directly
          updateStatus,
          aiohaUser: user, // Pass the username for broadcasting
          aiohaInstance: aioha, // Also pass the aioha instance for fallback
        });
      } else {
        // Execute ERC-20 airdrop
        await erc20Service.executeAirdrop(
          selectedToken,
          airdropUsers,
          totalAmount,
          updateStatus
        );
      }

      // After successful airdrop, post the announcement directly
      try {
        const announcementContent = generateAnnouncementContent(
          {
            token: selectedToken,
            recipients: airdropUsers,
            totalAmount: parseFloat(totalAmount),
            sortOption,
            customMessage,
            isWeighted: isWeightedAirdrop,
            includeSkateHive,
            creator: {
              hiveUsername: user,
              ethereumAddress,
            },
            isAnonymous,
          },
          networkScreenshot
        );

        const announcementResult = await createAirdropAnnouncement({
          token: selectedToken,
          recipients: airdropUsers,
          totalAmount: parseFloat(totalAmount),
          sortOption,
          customMessage,
          screenshotDataUrl: uploadedImageUrl, // Use uploaded image URL instead of raw screenshot
          isWeighted: isWeightedAirdrop,
          includeSkateHive,
          creator: {
            hiveUsername: user,
            ethereumAddress,
          },
          isAnonymous,
        });

        if (announcementResult.success && announcementResult.postUrl) {
          updateStatus({
            state: "completed",
            message: `✅ Announcement snap posted successfully! ${announcementResult.postUrl}`,
          });
        } else {
          updateStatus({
            state: "completed",
            message: `⚠️ Announcement snap failed: ${announcementResult.error}`,
          });
        }
      } catch (error) {
        updateStatus({
          state: "completed",
          message: "⚠️ Announcement snap posting failed",
        });
      }
    } catch (error) {
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApproveToken = async () => {
    if (!validation.isValid || isApproving) return;

    setIsApproving(true);
    resetStatus();

    try {
      await erc20Service.approveToken(selectedToken, totalAmount, updateStatus);
    } catch (error) {
    } finally {
      setIsApproving(false);
    }
  };

  // Navigation handlers
  const goToStep = (step: number, view: ModalView) => {
    setCurrentStep(step);
    setCurrentView(view);

    // Smart state resets when going back
    if (step < currentStep) {
      if (step === 1) {
        // Reset everything when going back to token selection
        setNetworkScreenshot("");
        setUploadedImageUrl("");
        setCostEstimate(null);
        resetStatus();
      } else if (step === 2) {
        // Reset preview-related states when going back to configuration
        setNetworkScreenshot("");
        setUploadedImageUrl("");
        setCostEstimate(null);
      } else if (step === 3) {
        // Reset announcement and execution states when going back to preview
        setUploadedImageUrl("");
        resetStatus();
      } else if (step === 4) {
        // Reset execution states when going back to announcement preview
        resetStatus();
      }
    }
  };

  // Handle moving from preview to announcement preview with screenshot capture
  const handlePreviewToAnnouncementPreview = async () => {
    // Always capture screenshot when moving to announcement preview
    setIsCapturingScreenshot(true);

    try {
      const screenshot = await captureAirdropNetworkScreenshot();
      setNetworkScreenshot(screenshot);
      goToStep(4, "announcementPreview");
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      // Continue to announcement preview even if screenshot fails
      goToStep(4, "announcementPreview");
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Handle moving from announcement preview to confirmation
  const handleAnnouncementPreviewToConfirmation = () => {
    goToStep(5, "confirmation");
  };

  // Modal content based on current view
  const getModalContent = () => {
    const totalSteps = 5;

    const stepHeaders = {
      tokenSelection: {
        title: "Select Token & Amount",
        subtitle: "Choose your token and total airdrop amount",
        emoji: "🎯",
      },
      configuration: {
        title: "Configure Recipients",
        subtitle: "Set filtering and selection criteria",
        emoji: "⚙️",
      },
      preview: {
        title: "Preview Recipients",
        subtitle: "Review who will receive the airdrop",
        emoji: "👥",
      },
      announcementPreview: {
        title: "Preview Announcement",
        subtitle: "Review the announcement post with network visualization",
        emoji: "📝",
      },
      confirmation: {
        title: "Final Confirmation",
        subtitle: "Review and execute your airdrop",
        emoji: "✅",
      },
    };

    const currentStepInfo = stepHeaders[currentView];

    const title = (
      <StepHeader
        currentStep={currentStep}
        totalSteps={totalSteps}
        title={currentStepInfo.title}
        subtitle={currentStepInfo.subtitle}
        emoji={currentStepInfo.emoji}
      />
    );

    switch (currentView) {
      case "tokenSelection":
        return {
          title,
          content: (
            <PortfolioProvider
              address={ethereumAddress}
              farcasterAddress={undefined}
              farcasterVerifiedAddresses={undefined}
            >
              <TokenSelectionStep
                selectedToken={selectedToken}
                totalAmount={totalAmount}
                tokenOptions={tokenOptions}
                isHiveConnected={isHiveConnected}
                isEthereumConnected={isEthereumConnected}
                onConfigChange={handleConfigChange}
                onNext={() => goToStep(2, "configuration")}
                onCancel={handleClose}
              />
            </PortfolioProvider>
          ),
          footer: (
            <HStack spacing={3} width="100%">
              <Button
                variant="ghost"
                onClick={handleClose}
                color="textSecondary"
                _hover={{ color: "text" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => goToStep(2, "configuration")}
                bg="primary"
                color="background"
                _hover={{ bg: "primaryDark" }}
                size={isMobile ? "sm" : "md"}
                flex="2"
                disabled={!selectedToken || parseFloat(totalAmount) <= 0 || totalAmount == "NaN"}
              >
                Next: Configure Recipients
              </Button>
            </HStack>
          ),
        };

      case "configuration":
        return {
          title,
          content: (
            <ConfigurationStep
              sortOption={sortOption}
              limit={limit}
              selectedToken={selectedToken}
              totalAmount={totalAmount}
              customMessage={customMessage}
              includeSkateHive={includeSkateHive}
              isWeightedAirdrop={isWeightedAirdrop}
              isAnonymous={isAnonymous}
              userCount={userCount}
              airdropUsers={airdropUsers}
              onSortOptionChange={setSortOption}
              onLimitChange={setLimit}
              onCustomMessageChange={setCustomMessage}
              onIncludeSkateHiveChange={setIncludeSkateHive}
              onWeightedAirdropChange={setIsWeightedAirdrop}
              onAnonymousChange={setIsAnonymous}
              onBack={() => goToStep(1, "tokenSelection")}
              onNext={() => goToStep(3, "preview")}
            />
          ),
          footer: (
            <HStack spacing={3} width="100%">
              <Button
                variant="outline"
                onClick={() => goToStep(1, "tokenSelection")}
                leftIcon={<ArrowBackIcon />}
                color="primary"
                borderColor="primary"
                _hover={{ bg: "primary", color: "background" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
              >
                Back
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => goToStep(3, "preview")}
                bg="primary"
                color="background"
                _hover={{ bg: "primaryDark" }}
                size={isMobile ? "sm" : "md"}
                flex="2"
                disabled={airdropUsers.length === 0}
              >
                Next: Preview Recipients
              </Button>
            </HStack>
          ),
        };

      case "preview":
        return {
          title,
          content: (
            <>
              <PreviewStep
                selectedToken={selectedToken}
                totalAmount={totalAmount}
                sortOption={sortOption}
                airdropUsers={airdropUsers}
                onBack={() => goToStep(2, "configuration")}
                onNext={handlePreviewToAnnouncementPreview}
                isCapturingScreenshot={isCapturingScreenshot}
                networkScreenshot={networkScreenshot}
              />
            </>
          ),
          footer: (
            <HStack spacing={3} width="100%">
              <Button
                variant="outline"
                onClick={() => goToStep(2, "configuration")}
                leftIcon={<ArrowBackIcon />}
                color="primary"
                borderColor="primary"
                _hover={{ bg: "primary", color: "background" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
              >
                Back
              </Button>
              <Button
                colorScheme="blue"
                onClick={handlePreviewToAnnouncementPreview}
                bg="primary"
                color="background"
                _hover={{ bg: "primaryDark" }}
                size={isMobile ? "sm" : "md"}
                flex="2"
                isLoading={isCapturingScreenshot}
                loadingText="Capturing..."
              >
                {isCapturingScreenshot
                  ? "Capturing Screenshot..."
                  : "Next: Preview Announcement"}
              </Button>
            </HStack>
          ),
        };

      case "announcementPreview":
        return {
          title,
          content: (
            <AnnouncementPreviewStep
              selectedToken={selectedToken}
              totalAmount={totalAmount}
              sortOption={sortOption}
              customMessage={customMessage}
              includeSkateHive={includeSkateHive}
              isWeightedAirdrop={isWeightedAirdrop}
              isAnonymous={isAnonymous}
              airdropUsers={airdropUsers}
              networkScreenshot={networkScreenshot}
              uploadedImageUrl={uploadedImageUrl}
              onUploadedImageUrlChange={setUploadedImageUrl}
              onBack={() => goToStep(3, "preview")}
              onNext={handleAnnouncementPreviewToConfirmation}
            />
          ),
          footer: (
            <HStack spacing={3} width="100%">
              <Button
                variant="outline"
                onClick={() => goToStep(3, "preview")}
                leftIcon={<ArrowBackIcon />}
                color="primary"
                borderColor="primary"
                _hover={{ bg: "primary", color: "background" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
              >
                Back
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleAnnouncementPreviewToConfirmation}
                bg="primary"
                color="background"
                _hover={{ bg: "primaryDark" }}
                size={isMobile ? "sm" : "md"}
                flex="2"
              >
                Next: Confirm & Execute
              </Button>
            </HStack>
          ),
        };

      case "confirmation":
        return {
          title,
          content: (
            <ConfirmationStep
              selectedToken={selectedToken}
              totalAmount={totalAmount}
              airdropUsers={airdropUsers}
              isHiveToken={isHiveToken}
              isHiveConnected={isHiveConnected}
              isEthereumConnected={isEthereumConnected}
              isExecuting={isExecuting}
              isApproving={isApproving}
              isEstimating={isEstimating}
              costEstimate={costEstimate}
              validation={validation}
              status={status}
              onBack={() => goToStep(4, "announcementPreview")}
              onStartOver={() => goToStep(1, "tokenSelection")}
              onExecute={handleExecuteAirdrop}
              onApprove={handleApproveToken}
              onEstimateCost={handleEstimateCost}
              onResetStatus={resetStatus}
            />
          ),
          footer: (
            <HStack spacing={3} width="100%">
              <Button
                variant="outline"
                onClick={() => goToStep(4, "announcementPreview")}
                leftIcon={<ArrowBackIcon />}
                color="primary"
                borderColor="primary"
                _hover={{ bg: "primary", color: "background" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
                disabled={isExecuting || isApproving}
              >
                Back
              </Button>

              <Button
                variant="outline"
                onClick={() => goToStep(1, "tokenSelection")}
                color="textSecondary"
                borderColor="border"
                _hover={{ bg: "cardBg" }}
                size={isMobile ? "sm" : "md"}
                flex="1"
                disabled={isExecuting || isApproving}
              >
                Start Over
              </Button>

              <Button
                colorScheme="green"
                onClick={handleExecuteAirdrop}
                isLoading={isExecuting}
                loadingText="Executing..."
                leftIcon={isExecuting ? undefined : <CheckIcon />}
                bg="green.500"
                color="white"
                _hover={{ bg: "green.600" }}
                size={isMobile ? "sm" : "md"}
                flex="2"
                isDisabled={!validation.isValid || isExecuting}
              >
                {isExecuting ? "Processing Airdrop..." : "Execute Airdrop"}
              </Button>
            </HStack>
          ),
        };

      default:
        return { title: null, content: null, footer: null };
    }
  };

  const modalContent = getModalContent();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size={isMobile ? "full" : "xl"}
        scrollBehavior={isMobile ? "outside" : "inside"}
        motionPreset="slideInBottom"
      >
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent
          bg="background"
          color="text"
          borderRadius={isMobile ? "0" : "10px"}
          border="1px solid"
          borderColor="border"
          shadow="lg"
          mx={isMobile ? 0 : 4}
          maxH={isMobile ? "95vh" : "90vh"}
          h={isMobile ? "95vh" : "auto"}
          display="flex"
          flexDirection="column"
        >
          <ModalHeader
            textAlign="center"
            fontSize="2xl"
            fontWeight="bold"
            color="primary"
            pb={2}
            flexShrink={0}
          >
            {modalContent.title}
          </ModalHeader>
          {/* Only show close button on first step to prevent accidental modal closure */}
          {currentView === "tokenSelection" && (
            <ModalCloseButton
              color="red"
              _hover={{ color: "background", bg: "primary" }}
              borderRadius="full"
            />
          )}

          <ModalBody
            px={isMobile ? 4 : 8}
            pb={isMobile ? 2 : 8}
            flex="1"
            overflowY="auto"
            display="flex"
            flexDirection="column"
            minH={0}
          >
            {modalContent.content}
          </ModalBody>

          <ModalFooter
            flexShrink={0}
            px={isMobile ? 4 : 6}
            py={isMobile ? 6 : 6}
            pb={isMobile ? "calc(1.5rem + env(safe-area-inset-bottom))" : 6}
            borderTop={isMobile ? "1px solid" : "none"}
            borderTopColor={isMobile ? "border" : "transparent"}
            bg={isMobile ? "rgba(0, 0, 0, 0.02)" : "transparent"}
          >
            {modalContent.footer}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default AirdropModal;
