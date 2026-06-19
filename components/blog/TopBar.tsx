"use client";
import {
  Flex,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Tooltip,
  ButtonGroup,
} from "@chakra-ui/react";
import { FaTh, FaBars, FaPen, FaSort } from "react-icons/fa";
import { FiBook } from "react-icons/fi";
import { useRouter, usePathname } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import { QueryType, ViewMode } from "@/config/blog.config";
import { useTranslations } from "@/contexts/LocaleContext";

interface TopBarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setQuery: (query: QueryType) => void;
  onQueryChange?: (query: QueryType) => void;
}

export default function TopBar({
  viewMode,
  setViewMode,
  setQuery,
  onQueryChange,
}: TopBarProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAioha();
  const isMagazinePage = pathname === "/magazine";

  const buttonStyle = {
    "&:hover": {
      boxShadow: "4px 4px 6px var(--chakra-colors-primary-alpha)",
    },
    "&:active": {
      transform: "translate(2px, 2px)",
      boxShadow: "2px 2px 3px var(--chakra-colors-primary-alpha)",
    },
  };

  const handleQueryChange = (query: QueryType) => {
    setQuery(query);
    onQueryChange?.(query);
  };

  return (
    <Flex
      justifyContent="space-between"
      mb={4}
      alignItems="center"
      pt={4}
      pl={8}
      pr={4}
    >
      <Flex flex="1" alignItems="center" gap={4}>
        {user && (
          <Button
            leftIcon={<FaPen />}
            onClick={() => router.push("/compose/workspace")}
            variant="outline"
            borderColor="primary"
            bg="background"
            color="primary"
            size="md"
            fontWeight="bold"
            px={6}
            py={2}
            borderRadius="none"
            boxShadow="0 2px 8px var(--chakra-colors-primary-alpha)"
            _hover={{
              borderColor: "primary",
              bg: "primary",
              color: "background",
              boxShadow: "0 4px 12px var(--chakra-colors-primary-alpha)",
            }}
            _active={{
              borderColor: "primary",
              bg: "primary",
              color: "background",
              boxShadow: "0 2px 4px var(--chakra-colors-primary-alpha)",
            }}
          >
            {t('blog.createPage')}
          </Button>
        )}
        <Button
          leftIcon={<FiBook />}
          onClick={() => {
            if (isMagazinePage) {
              router.push("/blog?view=magazine");
            } else {
              setViewMode("magazine");
            }
          }}
          variant="outline"
          borderColor="primary"
          bg="background"
          color="primary"
          size="md"
          fontWeight="bold"
          px={6}
          py={2}
          borderRadius="none"
          boxShadow="0 2px 8px var(--chakra-colors-primary-alpha)"
          display={{ base: "none", md: "flex" }}
          _hover={{
            borderColor: "primary",
            bg: "primary",
            color: "background",
            boxShadow: "0 4px 12px var(--chakra-colors-primary-alpha)",
          }}
          _active={{
            borderColor: "primary",
            bg: "primary",
            color: "background",
            boxShadow: "0 2px 4px var(--chakra-colors-primary-alpha)",
          }}
          isActive={viewMode === "magazine"}
        >
          {t('blog.readMagazine')}
        </Button>
      </Flex>
      <Flex flex="1" justifyContent="flex-end" alignItems="center">
        {/* Hide grid/list toggle on mobile */}
        <ButtonGroup
          size="sm"
          isAttached
          variant="outline"
          colorScheme="green"
          display={{ base: "none", md: "flex" }}
        >
          <Tooltip label={t('blog.gridView')} hasArrow>
            <IconButton
              aria-label={t('blog.gridView')}
              icon={<FaTh />}
              onClick={() => {
                if (isMagazinePage) {
                  router.push("/blog?view=grid");
                } else {
                  setViewMode("grid");
                }
              }}
              isActive={viewMode === "grid"}
              sx={buttonStyle}
            />
          </Tooltip>
          <Tooltip label={t('blog.listView')} hasArrow>
            <IconButton
              aria-label={t('blog.listView')}
              icon={<FaBars />}
              onClick={() => {
                if (isMagazinePage) {
                  router.push("/blog?view=list");
                } else {
                  setViewMode("list");
                }
              }}
              isActive={viewMode === "list"}
              sx={buttonStyle}
            />
          </Tooltip>
        </ButtonGroup>
        <Menu>
          <MenuButton
            as={Button}
            aria-label={t('blog.sort')}
            leftIcon={<FaSort />}
            variant="outline"
            ml={4}
            bg="background"
            color="primary"
            _hover={{ bg: "muted", color: "primary" }}
            _active={{ bg: "muted", color: "primary" }}
          >
            {t('blog.sort')}
          </MenuButton>
          <MenuList
            zIndex="popover"
            bg="background"
            color="primary"
            borderColor="primary"
          >
            <MenuItem
              bg="background"
              color="primary"
              _hover={{ bg: "muted", color: "primary" }}
              onClick={() => handleQueryChange("created")}
            >
              {t('blog.recent')}
            </MenuItem>
            <MenuItem
              bg="background"
              color="primary"
              _hover={{ bg: "muted", color: "primary" }}
              onClick={() => handleQueryChange("trending")}
            >
              {t('blog.trending')}
            </MenuItem>
            <MenuItem
              bg="background"
              color="primary"
              _hover={{ bg: "muted", color: "primary" }}
              onClick={() => handleQueryChange("highest_paid")}
            >
              {t('blog.highestPaid')}
            </MenuItem>
            <MenuItem
              bg="background"
              color="primary"
              _hover={{ bg: "muted", color: "primary" }}
              onClick={() => handleQueryChange("goat")}
            >
              {t('blog.goat')}
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>
    </Flex>
  );
}
