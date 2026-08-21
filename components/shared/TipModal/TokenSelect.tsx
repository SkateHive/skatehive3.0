"use client";

import { Flex, Image, Menu, MenuButton, MenuItem, MenuList, Portal, Text } from "@chakra-ui/react";

export interface TokenSelectOption {
  value: string;
  label: string;
  logo?: string;
}

interface TokenSelectProps {
  value: string;
  options: TokenSelectOption[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
  suffix?: string;
}

export default function TokenSelect({
  value,
  options,
  onChange,
  isDisabled,
  suffix,
}: TokenSelectProps) {
  const current = options.find((option) => option.value === value) ?? options[0];
  const needsScroll = options.length > 6;

  return (
    <Menu placement="bottom-end" isLazy>
      <MenuButton
        type="button"
        disabled={isDisabled}
        bg="transparent"
        border="none"
        outline="none"
        p={0}
        minW={0}
        w="fit-content"
        _hover={{ opacity: 0.8 }}
        _focus={{ boxShadow: "none" }}
        _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
      >
        <Flex align="center" gap={2} lineHeight="1">
          {current?.logo && (
            <Image src={current.logo} alt={current.label} boxSize="18px" borderRadius="full" flexShrink={0} />
          )}
          <Text fontSize="sm" color="inputText" fontFamily="mono" whiteSpace="nowrap">
            {current?.label}
          </Text>
          {suffix && (
            <Text fontSize="xs" color="dim" whiteSpace="nowrap">
              {suffix}
            </Text>
          )}
          <Text fontSize="10px" color="dim" flexShrink={0}>
            ▼
          </Text>
        </Flex>
      </MenuButton>
      <Portal>
        <MenuList
          bg="inputBg"
          borderColor="inputBorder"
          borderRadius={0}
          minW="140px"
          maxH={needsScroll ? "240px" : "auto"}
          overflowY={needsScroll ? "auto" : "visible"}
          p={0}
          zIndex="popover"
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              bg={option.value === value ? "panel" : "inputBg"}
              color="inputText"
              fontFamily="mono"
              fontSize="sm"
              borderRadius={0}
              _hover={{ bg: "primary", color: "background" }}
              _focus={{ bg: "primary", color: "background" }}
            >
              <Flex align="center" gap={2}>
                {option.logo && (
                  <Image src={option.logo} alt={option.label} boxSize="16px" borderRadius="full" />
                )}
                {option.label}
              </Flex>
            </MenuItem>
          ))}
        </MenuList>
      </Portal>
    </Menu>
  );
}
