import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Textarea, HStack, IconButton, Button, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import { useDropzone } from "react-dropzone";
import HiveMarkdown from "../shared/HiveMarkdown";
import { FaColumns } from "react-icons/fa";
import { TbGif } from "react-icons/tb";
import { MdPermMedia } from "react-icons/md";
import GIFMakerWithSelector, { GIFMakerRef as GIFMakerWithSelectorRef } from "../homepage/GIFMakerWithSelector";

interface MarkdownEditorProps {
  markdown: string;
  setMarkdown: (value: string) => void;
  onDrop: (acceptedFiles: File[]) => void;
  isDragActive: boolean;
  previewMode: "edit" | "preview" | "live";
  user?: any;
  handleMediaUpload?: () => void;
  isUploading?: boolean;
  insertAtCursor?: (text: string) => void;
  handleGifUpload?: (blob: Blob, fileName: string) => Promise<void>;
}

export default function MarkdownEditor({
  markdown,
  setMarkdown,
  onDrop,
  isDragActive,
  previewMode,
  user,
  handleMediaUpload,
  isUploading = false,
  insertAtCursor,
  handleGifUpload,
}: MarkdownEditorProps) {
  const [isGifMakerOpen, setGifMakerOpen] = useState(false);
  const gifMakerWithSelectorRef = useRef<GIFMakerWithSelectorRef>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgMain = "background";
  const bgMuted = "panel";
  const textPrimary = "text";
  const textMuted = "dim";
  const borderColor = "border";
  const primaryColor = "primary";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { getRootProps } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".gif", ".jpeg", ".jpg", ".webp"],
      "video/*": [".mp4", ".mov"],
    },
    multiple: false,
  });

  // Paste image handler (Ctrl+V / Cmd+V)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return; // Let normal text paste through
    e.preventDefault();
    onDrop(imageFiles);
  }, [onDrop]);

  const handleGifCreated = async (gifBlob: Blob, fileName: string) => {
    const gifFileName = fileName.endsWith('.gif') ? fileName : `${fileName}.gif`;

    if (handleGifUpload) {
      try {
        await handleGifUpload(gifBlob, gifFileName);
      } catch (error) {
        console.error("Error uploading GIF:", error);
        const gifUrl = URL.createObjectURL(gifBlob);
        if (insertAtCursor) {
          insertAtCursor(`\n![${gifFileName}](${gifUrl})\n`);
        } else {
          setMarkdown(markdown + `\n![${gifFileName}](${gifUrl})\n`);
        }
      }
    } else {
      const gifUrl = URL.createObjectURL(gifBlob);
      if (insertAtCursor) {
        insertAtCursor(`\n![${gifFileName}](${gifUrl})\n`);
      } else {
        setMarkdown(markdown + `\n![${gifFileName}](${gifUrl})\n`);
      }
    }
  };

  const handleInsert = (prefix: string, suffix: string = "") => {
    const textarea = document.querySelector('#markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);
    const newText = markdown.substring(0, start) + prefix + selectedText + suffix + markdown.substring(end);
    setMarkdown(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPosition = splitPosition;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newPosition = ((e.clientX - containerRect.left) / containerWidth) * 100;
      const clampedPosition = Math.max(20, Math.min(80, newPosition));
      setSplitPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <Box
      {...getRootProps()}
      ref={containerRef}
      position="relative"
      width="100%"
      height="100%"
      bg={bgMain}
      border={isDragActive ? "2px solid" : "1px solid"}
      borderColor={isDragActive ? primaryColor : borderColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <HStack
        spacing={1}
        px={3}
        py={2}
        bg={bgMuted}
        borderBottom="1px solid"
        borderColor={borderColor}
        flexWrap="wrap"
      >
        {isMounted && user && (
          <>
            <IconButton
              aria-label="Upload media (image or video)"
              icon={<MdPermMedia />}
              size="sm"
              variant="ghost"
              color={textMuted}
              _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
              onClick={handleMediaUpload}
              title="Upload Image or Video"
            />
            <IconButton
              aria-label="Create GIF"
              icon={<TbGif size={18} />}
              size="sm"
              variant="ghost"
              color={textMuted}
              _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
              onClick={() => {
                gifMakerWithSelectorRef.current?.reset();
                setGifMakerOpen(true);
              }}
            />
            <Box w="1px" h="18px" bg={borderColor} mx={1} />
          </>
        )}
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          fontWeight="600"
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("**", "**")}
        >
          B
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          fontStyle="italic"
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("*", "*")}
        >
          I
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("~~", "~~")}
        >
          S
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("\n- ")}
        >
          List
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("\n> ")}
        >
          Quote
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color={textMuted}
          h="28px"
          px={2}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => handleInsert("`", "`")}
        >
          Code
        </Button>
        <Box w="1px" h="18px" bg={borderColor} mx={1} />
        <IconButton
          aria-label="Toggle split view"
          icon={<FaColumns />}
          size="sm"
          variant="ghost"
          color={splitView ? primaryColor : textMuted}
          bg={splitView ? `${primaryColor}20` : "transparent"}
          _hover={{ color: textPrimary, bg: "rgba(255,255,255,0.06)" }}
          onClick={() => setSplitView(!splitView)}
        />
      </HStack>

      {splitView ? (
        <Flex flex={1} overflow="hidden">
          <Box flex={`0 0 ${splitPosition}%`} height="100%" borderRight="1px solid" borderColor={borderColor} display="flex" flexDirection="column">
            <Box overflow="auto" flex={1} width="100%">
              <Textarea
                id="markdown-textarea"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                onPaste={handlePaste}
                placeholder="Write your content here..."
                variant="unstyled"
                resize="none"
                width="100%"
                height="100%"
                p={4}
                fontSize="16px"
                lineHeight="1.7"
                fontFamily="inherit"
                bg="transparent"
                border="none"
                color={textPrimary}
                _placeholder={{ color: textMuted }}
                _focus={{ outline: "none", boxShadow: "none" }}
                sx={{
                  "&::placeholder": { color: `${textMuted} !important` },
                  "&:focus": { outline: "none !important", boxShadow: "none !important" },
                }}
                style={{ caretColor: primaryColor }}
              />
            </Box>
          </Box>
          <Box flex={`0 0 ${100 - splitPosition}%`} height="100%" bg={bgMain} overflow="auto" p={4}>
            <Text
              fontSize="11px"
              color={textMuted}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing="0.1em"
              mb={3}
            >
              Preview
            </Text>
            <Box color={textPrimary} fontSize="15px" lineHeight="1.7">
              <HiveMarkdown markdown={markdown} rawIframes={true} />
            </Box>
          </Box>
          <Box
            position="absolute"
            left={`${splitPosition}%`}
            top={0}
            bottom={0}
            width="6px"
            cursor="col-resize"
            bg="transparent"
            transform="translateX(-50%)"
            zIndex={10}
            _hover={{ bg: `${primaryColor}50` }}
            onMouseDown={handleSplitMouseDown}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Box w="2px" h="40px" bg={primaryColor} borderRadius="1px" opacity={0.5} />
          </Box>
        </Flex>
      ) : (
        <Box flex={1} overflow="hidden" display="flex" flexDirection="column">
          <Box overflow="auto" flex={1} width="100%">
            <Textarea
              id="markdown-textarea"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              onPaste={handlePaste}
              placeholder="Write your content here..."
              variant="unstyled"
              resize="none"
              width="100%"
              height="100%"
              p={4}
              fontSize="16px"
              lineHeight="1.7"
              fontFamily="inherit"
              bg="transparent"
              border="none"
              color={textPrimary}
              _placeholder={{ color: textMuted }}
              _focus={{ outline: "none", boxShadow: "none" }}
              sx={{
                "&::placeholder": { color: `${textMuted} !important` },
                "&:focus": { outline: "none !important", boxShadow: "none !important" },
              }}
              style={{ caretColor: primaryColor }}
            />
          </Box>
        </Box>
      )}

      {previewMode === "preview" && !splitView && (
        <Box
          p={4}
          bg={bgMuted}
          borderTop="1px solid"
          borderColor={borderColor}
          maxHeight="50%"
          overflow="auto"
        >
          <HiveMarkdown markdown={markdown} rawIframes={true} />
        </Box>
      )}

      <GIFMakerWithSelector
        ref={gifMakerWithSelectorRef}
        isOpen={isGifMakerOpen}
        onClose={() => {
          gifMakerWithSelectorRef.current?.reset();
          setGifMakerOpen(false);
        }}
        asModal={true}
        onGifCreated={handleGifCreated}
        onUpload={() => {}}
        isProcessing={false}
      />
    </Box>
  );
}
