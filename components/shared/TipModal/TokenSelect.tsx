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

  return (
    <Menu placement="bottom-end" isLazy>
      <MenuButton
        type="button"
        disabled={isDisabled}
        _hover={{ opacity: 0.8 }}
        _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
      >
        <Flex align="center" gap={2}>
          {current?.logo && (
            <Image src={current.logo} alt={current.label} boxSize="18px" borderRadius="full" />
          )}
          <Text fontSize="sm" color="inputText" fontFamily="mono">
            {current?.label}
          </Text>
          {suffix && (
            <Text fontSize="xs" color="dim">
              {suffix}
            </Text>
          )}
          <Text fontSize="10px" color="dim">
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
          maxH="240px"
          overflowY="auto"
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
