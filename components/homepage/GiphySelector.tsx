import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Input,
  Center,
  Spinner,
  InputGroup,
  InputRightElement,
  HStack,
  Button,
} from "@chakra-ui/react";
import { Grid } from "@giphy/react-components";
import { GiphyFetch, GifsResult } from "@giphy/js-fetch-api";
import { IGif } from "@giphy/js-types";
import { FaSearch } from "react-icons/fa";
import { TbGif } from "react-icons/tb";
import { useTranslations } from "@/contexts/LocaleContext";

interface GiphySelectorProps {
  apiKey: string;
  onSelect: (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => void;
  /** When set, shows a "+ GIF" button beside the search bar to open the GIF maker. */
  onCreateGif?: () => void;
}

const GiphySelector: React.FC<GiphySelectorProps> = ({
  apiKey,
  onSelect,
  onCreateGif,
}) => {
  const t = useTranslations();
  const gf = useMemo(() => new GiphyFetch(apiKey), [apiKey]);
  const [searchTerm, setSearchTerm] = useState("skateboard funny");
  const [isLoading, setIsLoading] = useState(false);
  const [showGrid, setShowGrid] = useState(true); // Controls Giphy grid visibility

  const fetchGifs = useCallback(
    async (offset: number): Promise<GifsResult> => {
      setIsLoading(true);
      const result = searchTerm
        ? await gf.search(searchTerm, { offset, limit: 10 })
        : await gf.trending({ offset, limit: 10 });
      setIsLoading(false);
      return result;
    },
    [gf, searchTerm]
  );

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
    setShowGrid(true); // Show grid when user types
  }, []);

  const handleSearchIconClick = useCallback(() => {
    setShowGrid((prev) => !prev); // Toggle grid visibility
  }, []);

  const handleGifClick = useCallback(
    (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => {
      onSelect(gif, e);
    },
    [onSelect]
  );

  useEffect(() => {
    // Only fetch gifs when component mounts, let the Grid component handle search updates
    if (showGrid) {
      fetchGifs(0);
    }
  }, [fetchGifs, showGrid]);

  return (
    <>
      <HStack spacing={2} align="center">
        <InputGroup>
          <InputRightElement>
            {isLoading ? (
              <Spinner />
            ) : (
              <FaSearch cursor="pointer" onClick={handleSearchIconClick} />
            )}
          </InputRightElement>
          <Input
            pr="4.5rem"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                fetchGifs(0); // Allows pressing Enter to search
                setShowGrid(true); // Show grid on Enter
              }
            }}
          />
        </InputGroup>
        {onCreateGif && (
          <Button
            data-testid="giphy-create-gif"
            aria-label={t("compose.gifMaker")}
            leftIcon={<TbGif size={22} color="var(--chakra-colors-primary)" />}
            onClick={onCreateGif}
            background="none"
            border="none"
            boxShadow="none"
            color="primary"
            fontWeight="normal"
            fontSize="sm"
            px={2}
            flexShrink={0}
            _hover={{ opacity: 0.7 }}
            _active={{ background: "none", boxShadow: "none" }}
            _focus={{ boxShadow: "none" }}
          >
            +
          </Button>
        )}
      </HStack>
      {showGrid && (
        <Center mt={4}>
          <Grid
            width={450}
            columns={3}
            fetchGifs={fetchGifs} // Use the fetchGifs function to get GIFs based on the current search term
            onGifClick={handleGifClick}
          />
        </Center>
      )}
    </>
  );
};

export default GiphySelector;
