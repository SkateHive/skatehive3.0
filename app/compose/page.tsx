"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flex,
  Input,
  Button,
  Center,
  Spinner,
  Box,
  Text,
  HStack,
  VStack,
  Alert,
  AlertIcon,
  Tooltip,
  SimpleGrid,
  Heading,
  Badge,
  Divider,
  IconButton,
  useToast,
} from "@chakra-ui/react";
import ImageCompressor, {
  ImageCompressorRef,
} from "@/lib/utils/ImageCompressor";
import VideoUploader, {
  VideoUploaderRef,
} from "@/components/homepage/VideoUploader";
import HashtagInput from "@/components/compose/HashtagInput";
import BeneficiariesInput from "@/components/compose/BeneficiariesInput";
import ThumbnailPicker from "@/components/compose/ThumbnailPicker";
import MarkdownEditor from "@/components/compose/MarkdownEditor";
import { useComposeForm } from "@/hooks/useComposeForm";
import { useImageUpload, useVideoUpload, useFileDropUpload } from "@/hooks/useFileUpload";
import { generateVideoIframeMarkdown } from "@/lib/markdown/composeUtils";
import { useDropzone } from "react-dropzone";
import { APP_CONFIG } from "@/config/app.config";
import { useTranslations } from "@/contexts/LocaleContext";
import { isHeicFile, convertHeicIfNeeded } from "@/lib/utils/heicToJpeg";
import { useSkateDialog } from "@/hooks/useSkateDialog";
import { ErrorBoundaryWithReport } from "@/components/shared/ErrorBoundary";
import {
  ComposeDraft,
  createBlankDraft,
  createDraftFromTemplate,
  createTemplateFromDraft,
  deleteDraft,
  getComposeTemplates,
  getStoredDrafts,
  upsertDraft,
  upsertTemplate,
} from "@/lib/compose/drafts";
import { useRouter, useSearchParams } from "next/navigation";
import { FaArrowLeft, FaFileAlt, FaFolderOpen, FaRegSave, FaTrash } from "react-icons/fa";

export default function Composer() {
  return (
    <Suspense
      fallback={
        <Center minH="100vh" bg="background">
          <Spinner color="primary" />
        </Center>
      }
    >
      <ComposerContent />
    </Suspense>
  );
}

function ComposerContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { prompt, SkateDialogComponent } = useSkateDialog();
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ComposeDraft[]>([]);
  const [templates, setTemplates] = useState(() => getComposeTemplates());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");

  const refreshDrafts = useCallback(() => {
    setDrafts(getStoredDrafts());
  }, []);

  const refreshTemplates = useCallback(() => {
    setTemplates(getComposeTemplates());
  }, []);

  const {
    markdown,
    setMarkdown,
    title,
    setTitle,
    hashtagInput,
    setHashtagInput,
    hashtags,
    setHashtags,
    beneficiaries,
    setBeneficiaries,
    placeholderIndex,
    selectedThumbnail,
    setSelectedThumbnail,
    uploadedThumbnail,
    setUploadedThumbnail,
    previewMode,
    placeholders,
    user,
    insertAtCursorWrapper,
    handleSubmit: originalHandleSubmit,
    isSubmitting,
  } = useComposeForm({
    onPublished: () => {
      if (activeDraftId) {
        deleteDraft(activeDraftId);
        refreshDrafts();
      }
    },
  });

  const [activeSettingsTab, setActiveSettingsTab] = useState<string>("thumbnail");

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        markdown,
        hashtags,
        selectedThumbnail,
        uploadedThumbnail,
        beneficiaries,
      }),
    [beneficiaries, hashtags, markdown, selectedThumbnail, title, uploadedThumbnail]
  );

  const saveCurrentDraft = useCallback(
    (showToast = false) => {
      if (!activeDraftId) return;

      const existingDraft = getStoredDrafts().find((draft) => draft.id === activeDraftId);
      const now = new Date().toISOString();
      const draft: ComposeDraft = {
        id: activeDraftId,
        title,
        markdown,
        hashtags,
        selectedThumbnail,
        uploadedThumbnail,
        beneficiaries,
        sourceTemplateId: existingDraft?.sourceTemplateId || null,
        createdAt: existingDraft?.createdAt || now,
        updatedAt: now,
      };

      upsertDraft(draft);
      refreshDrafts();
      setLastSavedAt(now);
      setLastSavedSnapshot(draftSnapshot);

      if (showToast) {
        toast({
          title: t("compose.draftSaved"),
          status: "success",
          duration: 1800,
          isClosable: true,
        });
      }
    },
    [
      activeDraftId,
      beneficiaries,
      draftSnapshot,
      hashtags,
      markdown,
      refreshDrafts,
      selectedThumbnail,
      t,
      title,
      toast,
      uploadedThumbnail,
    ]
  );

  const handleSubmit = useCallback(() => {
    saveCurrentDraft(false);
    originalHandleSubmit();
  }, [originalHandleSubmit, saveCurrentDraft]);

  const handleSaveTemplate = useCallback(() => {
    if (!title.trim() && !markdown.trim()) {
      toast({
        title: t("compose.templateNeedsContent"),
        status: "warning",
        duration: 2200,
        isClosable: true,
      });
      return;
    }

    const existingDraft = activeDraftId
      ? getStoredDrafts().find((draft) => draft.id === activeDraftId)
      : null;
    const existingTemplate = templates.find(
      (template) => template.id === existingDraft?.sourceTemplateId
    );
    const template = createTemplateFromDraft(
      {
        title,
        markdown,
        hashtags,
        sourceTemplateId: existingDraft?.sourceTemplateId || null,
      },
      existingTemplate
    );

    upsertTemplate(template);
    refreshTemplates();

    if (activeDraftId) {
      const now = new Date().toISOString();
      upsertDraft({
        id: activeDraftId,
        title,
        markdown,
        hashtags,
        selectedThumbnail,
        uploadedThumbnail,
        beneficiaries,
        sourceTemplateId: template.id,
        createdAt: existingDraft?.createdAt || now,
        updatedAt: now,
      });
      refreshDrafts();
      setLastSavedAt(now);
      setLastSavedSnapshot(
        JSON.stringify({
          title,
          markdown,
          hashtags,
          selectedThumbnail,
          uploadedThumbnail,
          beneficiaries,
        })
      );
    }

    toast({
      title: t("compose.templateSaved"),
      status: "success",
      duration: 2200,
      isClosable: true,
    });
  }, [
    activeDraftId,
    beneficiaries,
    hashtags,
    markdown,
    refreshDrafts,
    refreshTemplates,
    selectedThumbnail,
    t,
    templates,
    title,
    toast,
    uploadedThumbnail,
  ]);

  useEffect(() => {
    refreshDrafts();
    refreshTemplates();
  }, [refreshDrafts, refreshTemplates]);

  useEffect(() => {
    const draftId = searchParams.get("draft");
    setActiveDraftId(draftId);
    setHasLoadedDraft(false);
    setHasUserEdited(false);
  }, [searchParams]);

  useEffect(() => {
    if (!activeDraftId || hasLoadedDraft) return;

    const draft = getStoredDrafts().find((item) => item.id === activeDraftId);
    if (!draft) {
      setHasLoadedDraft(true);
      return;
    }

    setTitle(draft.title);
    setMarkdown(draft.markdown);
    setHashtags(draft.hashtags || []);
    setHashtagInput("");
    setSelectedThumbnail(draft.selectedThumbnail || null);
    setUploadedThumbnail(draft.uploadedThumbnail || null);
    setBeneficiaries(draft.beneficiaries || []);
    setLastSavedAt(draft.updatedAt);
    setLastSavedSnapshot(
      JSON.stringify({
        title: draft.title,
        markdown: draft.markdown,
        hashtags: draft.hashtags || [],
        selectedThumbnail: draft.selectedThumbnail || null,
        uploadedThumbnail: draft.uploadedThumbnail || null,
        beneficiaries: draft.beneficiaries || [],
      })
    );
    setHasLoadedDraft(true);
  }, [
    activeDraftId,
    hasLoadedDraft,
    setBeneficiaries,
    setHashtagInput,
    setHashtags,
    setMarkdown,
    setSelectedThumbnail,
    setTitle,
    setUploadedThumbnail,
  ]);

  useEffect(() => {
    if (!activeDraftId || !hasLoadedDraft) return;
    if (draftSnapshot === lastSavedSnapshot) return;

    const hasContent =
      title.trim() ||
      markdown.trim() ||
      hashtags.length > 0 ||
      selectedThumbnail ||
      uploadedThumbnail ||
      beneficiaries.length > 0;

    if (!hasContent) return;

    setHasUserEdited(true);
  }, [
    activeDraftId,
    beneficiaries.length,
    draftSnapshot,
    hasLoadedDraft,
    hashtags.length,
    lastSavedSnapshot,
    markdown,
    selectedThumbnail,
    title,
    uploadedThumbnail,
  ]);

  useEffect(() => {
    if (!activeDraftId || !hasLoadedDraft || !hasUserEdited) return;
    if (draftSnapshot === lastSavedSnapshot) return;

    const timeout = window.setTimeout(() => {
      saveCurrentDraft(false);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [
    activeDraftId,
    draftSnapshot,
    hasLoadedDraft,
    hasUserEdited,
    lastSavedSnapshot,
    saveCurrentDraft,
  ]);

  useEffect(() => {
    if (!activeDraftId) return;

    const handleBeforeUnload = () => {
      saveCurrentDraft(false);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeDraftId, saveCurrentDraft]);

  const openDraft = useCallback(
    (draft: ComposeDraft) => {
      router.push(`/compose?draft=${draft.id}`);
    },
    [router]
  );

  const startBlankDraft = useCallback(() => {
    const draft = createBlankDraft();
    upsertDraft(draft);
    refreshDrafts();
    router.push(`/compose?draft=${draft.id}`);
  }, [refreshDrafts, router]);

  const startTemplateDraft = useCallback(
    (templateId: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;

      const draft = createDraftFromTemplate(template);
      upsertDraft(draft);
      refreshDrafts();
      router.push(`/compose?draft=${draft.id}`);
    },
    [refreshDrafts, router, templates]
  );

  const handleDeleteDraft = useCallback(
    (draftId: string) => {
      deleteDraft(draftId);
      refreshDrafts();
      if (activeDraftId === draftId) {
        router.push("/compose");
      }
    },
    [activeDraftId, refreshDrafts, router]
  );

  const formatDraftDate = useCallback((isoDate: string) => {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoDate));
  }, []);

  const lastSavedLabel = lastSavedAt ? formatDraftDate(lastSavedAt) : t("compose.notSavedYet");

  const draftHome = (
      <ErrorBoundaryWithReport>
        <Flex width="100%" minHeight="100vh" bg="background" justify="center" p={{ base: 3, md: 6 }}>
          <VStack width="100%" maxWidth="1200px" align="stretch" spacing={6}>
            <Box>
              <Heading as="h1" size="lg" color="text" mb={2}>
                {t("compose.createWorkspace")}
              </Heading>
              <Text color="dim">{t("compose.createWorkspaceSubtitle")}</Text>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Button
                leftIcon={<FaFileAlt />}
                onClick={startBlankDraft}
                h="72px"
                justifyContent="flex-start"
                border="1px solid"
                borderColor="primary"
                bg="primary"
                color="background"
                _hover={{ bg: "accent" }}
              >
                {t("compose.createBlankPost")}
              </Button>
              <Button
                leftIcon={<FaFolderOpen />}
                onClick={() => {
                  const firstDraft = drafts[0];
                  if (firstDraft) openDraft(firstDraft);
                }}
                h="72px"
                justifyContent="flex-start"
                border="1px solid"
                borderColor="border"
                bg="panel"
                color="text"
                isDisabled={drafts.length === 0}
                _hover={{ bg: "panelHover" }}
              >
                {t("compose.continueLatestDraft")}
              </Button>
            </SimpleGrid>

            <Box>
              <HStack justify="space-between" mb={3}>
                <Heading as="h2" size="md" color="text">
                  {t("compose.drafts")}
                </Heading>
                <Badge bg="subtle" color="dim">
                  {drafts.length}
                </Badge>
              </HStack>
              {drafts.length === 0 ? (
                <Box border="1px solid" borderColor="border" bg="panel" p={5}>
                  <Text color="dim">{t("compose.noDrafts")}</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {drafts.map((draft) => (
                    <Box
                      key={draft.id}
                      onClick={() => openDraft(draft)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDraft(draft);
                        }
                      }}
                      textAlign="left"
                      p={4}
                      border="1px solid"
                      borderColor="border"
                      bg="panel"
                      color="text"
                      _hover={{ bg: "panelHover", borderColor: "primary" }}
                      width="100%"
                    >
                      <HStack justify="space-between" spacing={3} width="100%">
                        <VStack align="start" spacing={1} minW={0}>
                          <Text fontWeight="700" noOfLines={1}>
                            {draft.title.trim() || t("compose.untitledDraft")}
                          </Text>
                          <Text fontSize="sm" color="dim">
                            {t("compose.lastModified")} {formatDraftDate(draft.updatedAt)}
                          </Text>
                        </VStack>
                        <IconButton
                          aria-label={t("compose.deleteDraft")}
                          icon={<FaTrash />}
                          size="sm"
                          variant="outline"
                          borderColor="border"
                          color="text"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteDraft(draft.id);
                          }}
                        />
                      </HStack>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Box>

            <Divider borderColor="border" />

            <Box>
              <Heading as="h2" size="md" color="text" mb={3}>
                {t("compose.templates")}
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    onClick={() => startTemplateDraft(template.id)}
                    h="auto"
                    minH="92px"
                    p={4}
                    justifyContent="flex-start"
                    whiteSpace="normal"
                    border="1px solid"
                    borderColor="border"
                    bg="panel"
                    color="text"
                    _hover={{ bg: "panelHover", borderColor: "primary" }}
                  >
                    <VStack align="start" spacing={2} width="100%">
                      <Text fontWeight="700">{template.title}</Text>
                      <Text color="dim" fontSize="sm" textAlign="left" noOfLines={2}>
                        {template.description}
                      </Text>
                      {template.isCustom && (
                        <Badge bg="subtle" color="primary">
                          {t("compose.userTemplate")}
                        </Badge>
                      )}
                    </VStack>
                  </Button>
                ))}
              </SimpleGrid>
            </Box>
          </VStack>
          <SkateDialogComponent />
        </Flex>
      </ErrorBoundaryWithReport>
  );

  React.useEffect(() => {}, [
    beneficiaries,
    title,
    markdown,
    hashtags,
    isSubmitting,
  ]);

  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);

  const handleImageUploadWithCaption = async (
    url: string | null,
    fileName?: string,
    originalFile?: File
  ) => {
    console.log("🔍 handleImageUploadWithCaption called:", { url, fileName, hasOriginalFile: !!originalFile });
    setIsImageUploading(true);
    setUploadError(null);
    if (url) {
      try {
        console.log("📤 Fetching blob and uploading to IPFS...");
        const blob = await fetch(url).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
          return res.blob();
        });
        const { uploadToIpfs } = await import("@/lib/markdown/composeUtils");
        const ipfsUrl = await uploadToIpfs(
          blob,
          fileName || "compressed-image.jpg"
        );
        console.log("✅ IPFS upload successful:", ipfsUrl);

        console.log("📝 Inserting at cursor...");
        insertAtCursorWrapper(`\n![](${ipfsUrl})\n`);
        console.log("✅ Insert complete!");
      } catch (error) {
        console.error("❌ Error uploading image:", error);
        setUploadError(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsImageUploading(false);
      }
    } else {
      console.warn("⚠️ No URL provided to handleImageUploadWithCaption");
      setUploadError("Image upload failed. No URL received from compressor.");
      setIsImageUploading(false);
    }
  };

  const {
    isUploading: isImageUploading,
    isCompressingImage,
    createImageTrigger,
    setIsUploading: setIsImageUploading,
  } = useImageUpload(insertAtCursorWrapper, {
    onRequestDescription: prompt,
  });

  const {
    isCompressingVideo,
    createVideoTrigger,
    setIsCompressingVideo,
  } = useVideoUpload(insertAtCursorWrapper);

  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showThumbnailWarning, setShowThumbnailWarning] = useState(false);

  const handleGifUpload = async (gifBlob: Blob, fileName: string) => {
    try {
      const gifFileName = fileName.endsWith(".gif")
        ? fileName
        : `${fileName}.gif`;

      const gifFile = new File([gifBlob], gifFileName, { type: "image/gif" });

      const { uploadToIpfs } = await import("@/lib/markdown/composeUtils");
      const ipfsUrl = await uploadToIpfs(gifFile, gifFileName);

      insertAtCursorWrapper(`\n![](${ipfsUrl})\n`);
    } catch (error) {
      console.error("Error uploading GIF to IPFS:", error);
      throw error;
    }
  };

  const handleImageTrigger = createImageTrigger(imageCompressorRef);
  const handleVideoTrigger = createVideoTrigger(videoUploaderRef);

  // Unified media upload handler - simply triggers the appropriate uploader based on their internal file inputs
  const handleMediaUpload = () => {
    // Create a temporary file input that accepts both images and videos
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      document.body.removeChild(input);
      
      if (!file) return;
      
      if (file.type.startsWith('image/') || isHeicFile(file)) {
        // Set state for image upload
        setIsImageUploading(true);
        // Convert HEIC → JPEG before processing
        const imageFile = isHeicFile(file) ? await convertHeicIfNeeded(file) : file;
        // Manually process the image file through the image upload pipeline
        const reader = new FileReader();
        reader.onload = async () => {
          const url = reader.result as string;
          await handleImageUploadWithCaption(url, imageFile.name, imageFile);
        };
        reader.readAsDataURL(imageFile);
      } else if (file.type.startsWith('video/')) {
        // Directly pass file to video uploader's handleFile method
        if (videoUploaderRef.current) {
          setIsCompressingVideo(true);
          videoUploaderRef.current.handleFile(file);
        }
      }
    };
    
    input.click();
  };

  const { isUploading: isDropUploading, onDrop } = useFileDropUpload(
    insertAtCursorWrapper
  );
  const { isDragActive } = useDropzone({ onDrop, noClick: true });

  const isUploading = isImageUploading || isDropUploading;

  if (!activeDraftId) {
    return draftHome;
  }

  return (
    <ErrorBoundaryWithReport>
    <Flex
      width="100%"
      minHeight="100vh"
      bg="background"
      justify="center"
      p={{ base: 3, md: 6 }}
      direction="column"
    >
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "stretch", md: "center" }}
        justify={{ base: "flex-start", md: "space-between" }}
        mb={4}
        gap={3}
        width="100%"
        maxWidth="1200px"
        mx="auto"
      >
        <Button
          leftIcon={<FaArrowLeft />}
          variant="outline"
          borderColor="border"
          color="text"
          onClick={() => router.push("/compose")}
          alignSelf={{ base: "flex-start", md: "center" }}
        >
          {t("common.back")}
        </Button>
        <Input
          placeholder={placeholders[placeholderIndex]}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          size="lg"
          fontSize="1.5rem"
          fontWeight="600"
          flex="1"
          minW={0}
          border="1px solid"
          borderColor="inputBorder"
          color="inputText"
          bg="inputBg"
          _placeholder={{ color: "inputPlaceholder" }}
          _hover={{ borderColor: "primary" }}
          _focus={{
            borderColor: "primary",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
          }}
          maxLength={123}
        />
      </Flex>

      {isUploading && (
        <Center mb={3}>
          <HStack spacing={2} color="dim">
            <Spinner size="sm" color="primary" />
            <Text fontSize="sm">{t('compose.uploading')}</Text>
          </HStack>
        </Center>
      )}

      <Flex width="100%" justify="center" mb={3}>
        <Box width="100%" maxWidth="1200px">
          <VideoUploader
            ref={videoUploaderRef}
            username={user || undefined}
            onUploadStart={() => {
              setVideoError(null);
              setIsCompressingVideo(true);
            }}
            onUploadFinish={() => {
              setIsCompressingVideo(false);
            }}
            onError={(error: string) => {
              console.error("Video upload error:", error);
              setVideoError(error);
            }}
            onUpload={(result: { url?: string; hash?: string } | null) => {
              console.log("Video upload result:", result);
              if (result?.url) {
                // Insert iframe into markdown body using utility function
                insertAtCursorWrapper(generateVideoIframeMarkdown(result.url));
              }
            }}
          />
        </Box>
      </Flex>

      {videoError && (
        <Alert 
          status="error" 
          mb={3} 
          maxWidth="1200px" 
          mx="auto" 
          width="100%"
          bg="rgba(200, 50, 50, 0.1)"
          border="1px solid"
          borderColor="error"
          color="text"
        >
          <AlertIcon color="error" />
          <Box flex="1">
            <Text fontWeight="bold" mb={1}>{t('compose.videoUploadFailed')}</Text>
            <Text whiteSpace="pre-wrap" fontSize="sm">{videoError}</Text>
          </Box>
          <Button
            size="sm"
            variant="ghost"
            color="error"
            onClick={() => setVideoError(null)}
          >
            {t('compose.dismiss')}
          </Button>
        </Alert>
      )}

      <Flex
        h="500px"
        justify="center"
        width="100%"
        maxWidth="1200px"
        mx="auto"
        border="1px solid"
        borderColor="border"
      >
        <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
          <MarkdownEditor
            markdown={markdown}
            setMarkdown={setMarkdown}
            onDrop={onDrop}
            isDragActive={isDragActive}
            previewMode={previewMode}
            user={user}
            handleMediaUpload={handleMediaUpload}
            isUploading={isUploading}
            insertAtCursor={insertAtCursorWrapper}
            handleGifUpload={handleGifUpload}
          />
        </Box>

        <ImageCompressor
          ref={imageCompressorRef}
          onUpload={handleImageUploadWithCaption}
          isProcessing={isCompressingImage}
          hideStatus={true}
        />
      </Flex>

      {uploadError && (
        <Alert 
          status="error" 
          mb={3} 
          maxWidth="1200px" 
          mx="auto" 
          width="100%"
          bg="rgba(200, 50, 50, 0.1)"
          border="1px solid"
          borderColor="error"
          color="text"
        >
          <AlertIcon color="error" />
          <Box flex="1">
            <Text fontWeight="bold" mb={1}>{t('compose.imageUploadFailed')}</Text>
            <Text whiteSpace="pre-wrap" fontSize="sm">{uploadError}</Text>
          </Box>
          <Button
            size="sm"
            variant="ghost"
            color="error"
            onClick={() => setUploadError(null)}
          >
            {t('compose.dismiss')}
          </Button>
        </Alert>
      )}

      <Box maxWidth="1200px" mx="auto" width="100%" mt={4}>
        <HashtagInput
          hashtags={hashtags}
          hashtagInput={hashtagInput}
          setHashtagInput={setHashtagInput}
          setHashtags={setHashtags}
        />
      </Box>

      <Box mt={4} maxWidth="1200px" mx="auto" width="100%">
        <HStack spacing={0} mb={0} align="stretch">
          <Button
            size="sm"
            onClick={() => setActiveSettingsTab("thumbnail")}
            border="1px solid"
            borderColor={activeSettingsTab === "thumbnail" ? "primary" : "border"}
            borderBottomColor={activeSettingsTab === "thumbnail" ? "background" : "border"}
            bg={activeSettingsTab === "thumbnail" ? "panel" : "transparent"}
            color={activeSettingsTab === "thumbnail" ? "primary" : "dim"}
            fontWeight="medium"
            fontSize="sm"
            _hover={{
              bg: activeSettingsTab === "thumbnail" ? "panelHover" : "subtle",
              color: activeSettingsTab === "thumbnail" ? "primary" : "text",
            }}
            mr="-1px"
            px={4}
            h="36px"
          >
            🖼️ {t('compose.thumbnail')}
          </Button>
          <Button
            size="sm"
            onClick={() => setActiveSettingsTab("beneficiaries")}
            border="1px solid"
            borderColor={activeSettingsTab === "beneficiaries" ? "primary" : "border"}
            borderBottomColor={activeSettingsTab === "beneficiaries" ? "background" : "border"}
            bg={activeSettingsTab === "beneficiaries" ? "panel" : "transparent"}
            color={activeSettingsTab === "beneficiaries" ? "primary" : "dim"}
            fontWeight="medium"
            fontSize="sm"
            _hover={{
              bg: activeSettingsTab === "beneficiaries" ? "panelHover" : "subtle",
              color: activeSettingsTab === "beneficiaries" ? "primary" : "text",
            }}
            ml="-1px"
            px={4}
            h="36px"
          >
            💰 {t('compose.beneficiaries')} {beneficiaries.length > 0 && `(${beneficiaries.length})`}
          </Button>
        </HStack>

        {activeSettingsTab === "thumbnail" && (
          <Box
            p={4}
            bg="panel"
            border="1px solid"
            borderColor="border"
          >
            <ThumbnailPicker
              show={true}
              markdown={markdown}
              selectedThumbnail={selectedThumbnail}
              setSelectedThumbnail={setSelectedThumbnail}
              uploadedThumbnail={uploadedThumbnail}
              setUploadedThumbnail={setUploadedThumbnail}
            />
          </Box>
        )}

        {activeSettingsTab === "beneficiaries" && (
          <Box
            p={4}
            bg="panel"
            border="1px solid"
            borderColor="border"
          >
            <BeneficiariesInput
              beneficiaries={beneficiaries}
              setBeneficiaries={(newBeneficiaries) => {
                setBeneficiaries(newBeneficiaries);
              }}
              isSubmitting={isSubmitting}
            />
          </Box>
        )}
      </Box>

      {showThumbnailWarning && !selectedThumbnail && (
        <Alert
          status="warning"
          mb={3}
          maxWidth="1200px"
          mx="auto"
          width="100%"
          bg="rgba(255, 193, 7, 0.1)"
          border="1px solid"
          borderColor="warning"
          color="text"
        >
          <AlertIcon color="warning" />
          <Box flex="1">
            <Text fontWeight="bold" mb={1}>{t('compose.thumbnailRequired')}</Text>
            <Text fontSize="sm">{t('compose.selectThumbnailWarning')}</Text>
          </Box>
          <Button
            size="sm"
            variant="ghost"
            color="warning"
            onClick={() => {
              setShowThumbnailWarning(false);
              setActiveSettingsTab("thumbnail");
            }}
          >
            {t('compose.selectThumbnail')}
          </Button>
        </Alert>
      )}

      <Flex
        mt={4}
        justify="space-between"
        align={{ base: "stretch", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
        maxWidth="1200px"
        mx="auto"
        width="100%"
      >
        <VStack align={{ base: "stretch", md: "start" }} spacing={3} color="dim" fontSize="sm">
          <Text>
            {t("compose.draftSavedStatus")}: {lastSavedLabel}
          </Text>
          <Flex direction={{ base: "column", md: "row" }} gap={3} width="100%">
          <Button
            leftIcon={<FaRegSave />}
            size="md"
            variant="outline"
            borderColor="border"
            color="text"
            onClick={() => saveCurrentDraft(true)}
            onBlur={() => saveCurrentDraft(false)}
            isDisabled={!activeDraftId}
            width={{ base: "100%", md: "auto" }}
          >
            {t("compose.saveDraft")}
          </Button>
          <Button
            leftIcon={<FaFileAlt />}
            size="md"
            variant="outline"
            borderColor="border"
            color="text"
            onClick={handleSaveTemplate}
            isDisabled={!title.trim() && !markdown.trim()}
            width={{ base: "100%", md: "auto" }}
          >
            {t("compose.saveTemplate")}
          </Button>
          </Flex>
        </VStack>
        <Tooltip
          label={
            !selectedThumbnail
              ? t('compose.selectThumbnailFirst')
              : !title.trim()
              ? t('compose.addTitleFirst')
              : ""
          }
          isDisabled={!!selectedThumbnail && !!title.trim() && !isSubmitting}
          hasArrow
          bg="error"
          color="white"
          placement="top"
        >
          <Button
            size="md"
            bg="primary"
            color="background"
            fontWeight="bold"
            onClick={() => {
              if (!selectedThumbnail) {
                setShowThumbnailWarning(true);
                return;
              }
              handleSubmit();
            }}
            isLoading={isSubmitting}
            loadingText={t('compose.publishing')}
            isDisabled={isSubmitting || !title.trim() || !selectedThumbnail}
            px={10}
            h="44px"
            width={{ base: "100%", md: "auto" }}
            _hover={{ bg: "accent" }}
          >
            {t('compose.publish')}
          </Button>
        </Tooltip>
      </Flex>
      <SkateDialogComponent />
    </Flex>
    </ErrorBoundaryWithReport>
  );
}
