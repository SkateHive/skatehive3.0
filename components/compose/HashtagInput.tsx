import React from "react";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  Box,
  Flex,
  Input,
  Tag,
  TagCloseButton,
  TagLabel,
  Wrap,
  WrapItem,
  Text,
} from "@chakra-ui/react";

interface HashtagInputProps {
  hashtags: string[];
  hashtagInput: string;
  setHashtagInput: (value: string) => void;
  setHashtags: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function HashtagInput({
  hashtags,
  hashtagInput,
  setHashtagInput,
  setHashtags,
}: HashtagInputProps) {
  const t = useTranslations();
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      (e.key === " " || e.key === "Enter" || e.key === ",") &&
      hashtagInput.trim()
    ) {
      e.preventDefault();
      setHashtags((prev) => [...prev, hashtagInput.trim()]);
      setHashtagInput("");
    } else if (e.key === "Backspace" && !hashtagInput && hashtags.length) {
      setHashtags((prev) => prev.slice(0, -1));
    }
  };

  const removeHashtag = (index: number) => {
    setHashtags((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Box
      bg="panel"
      border="1px solid"
      borderColor="border"
      p={4}
    >
      <Text
        letterSpacing="0.1em"
        fontSize="11px"
        color="dim"
        mb={3}
        fontWeight="600"
        textTransform="uppercase"
      >
        Hashtags
      </Text>
      <Flex width="100%" direction="row" alignItems="center" gap={4}>
        <Input
          placeholder={t('compose.hashtagPlaceholder')}
          value={hashtagInput}
          onChange={(e) => setHashtagInput(e.target.value)}
          onKeyDown={handleHashtagKeyDown}
          height="44px"
          flex="1"
          bg="inputBg"
          border="1px solid"
          borderColor="inputBorder"
          color="inputText"
          _placeholder={{ color: "inputPlaceholder" }}
          _hover={{ borderColor: "primary" }}
          _focus={{
            borderColor: "primary",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
          }}
          fontSize="15px"
        />
      </Flex>
      <Box mt={3}>
        <Wrap justify="flex-start">
          {hashtags.map((tag, index) => (
            <WrapItem key={index}>
              <Tag
                size="lg"
                borderRadius="20px"
                variant="outline"
                borderColor="primary"
                bg="transparent"
                _hover={{
                  borderColor: "primary",
                  bg: "subtle",
                }}
              >
                <TagLabel color="primary" fontWeight="500">#{tag}</TagLabel>
                <TagCloseButton
                  onClick={() => removeHashtag(index)}
                  color="dim"
                  _hover={{ color: "text" }}
                />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      </Box>
    </Box>
  );
}
