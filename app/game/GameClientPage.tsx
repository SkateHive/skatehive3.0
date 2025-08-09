"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Heading,
  Button,
  Text,
  Kbd,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useColorModeValue,
  VStack,
  HStack,
  Icon,
  Divider,
  Circle,
} from "@chakra-ui/react";
import {
  MdFullscreen,
  MdClose,
  MdVolumeUp,
  MdSettings,
  MdPower,
  MdRefresh,
} from "react-icons/md";

export default function GameClientPage() {
  const [isModalFullscreen, setIsModalFullscreen] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [gameScale, setGameScale] = useState(0.7); // Start at 70% size

  const toggleModalFullscreen = useCallback(() => {
    setIsModalFullscreen((prev) => !prev);
  }, [setIsModalFullscreen]);

  const refreshGame = useCallback(() => {
    setGameKey((prev) => prev + 1);
  }, []);

  const increaseSize = useCallback(() => {
    setGameScale((prev) => Math.min(prev + 0.1, 1.0)); // Max 100%
  }, []);

  const decreaseSize = useCallback(() => {
    setGameScale((prev) => Math.max(prev - 0.1, 0.4)); // Min 40%
  }, []);

  const bgColor = useColorModeValue("gray.900", "gray.900");
  const textColor = useColorModeValue("white", "white");
  const gameBg = useColorModeValue("black", "black");
  const instructionColor = useColorModeValue("gray.400", "gray.400");
  const kbdBg = useColorModeValue("gray.700", "gray.700");

  // Muted color palette for TV controls
  const mutedPrimary = "#8B7355"; // Muted brown-tan
  const mutedSecondary = "#6B5B47"; // Darker muted brown
  const mutedAccent = "#A0956B"; // Light muted tan
  const mutedHighlight = "#9A8B6B"; // Subtle highlight

  useEffect(() => {
    // Prevent page scrolling
    document.body.style.overflow = "hidden";

    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent arrow keys and WASD from scrolling the page
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
        ].includes(event.key)
      ) {
        event.preventDefault();
      }

      // F key for fullscreen toggle
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleModalFullscreen();
      }
      // Escape key to exit fullscreen
      if (event.key === "Escape" && isModalFullscreen) {
        event.preventDefault();
        setIsModalFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      // Restore scrolling when component unmounts
      document.body.style.overflow = "auto";
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [isModalFullscreen, toggleModalFullscreen]);

  return (
    <>
      <Box
        minH="100vh"
        h="100vh"
        bg={bgColor}
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        p={0}
      >
        {/* TV Container */}
        <Box
          w="100vw"
          h="100vh"
          maxW="none"
          maxH="none"
          bg="linear-gradient(135deg, #8B4513, #A0522D, #8B4513)"
          p={4}
          borderRadius="0"
          boxShadow="none"
          border="none"
          position="relative"
          display="flex"
          flexDirection="column"
        >
          {/* TV Screen Bezel */}
          <Box
            bg="linear-gradient(135deg, #2D2D2D, #1A1A1A)"
            p={6}
            borderRadius="16px"
            border="4px solid #444"
            boxShadow="inset 0 0 20px rgba(0,0,0,0.8)"
            position="relative"
            flex="1"
          >
            {/* Screen */}
            <Box
              bg="black"
              borderRadius="12px"
              overflow="hidden"
              position="relative"
              border="2px solid #333"
              boxShadow="inset 0 0 30px rgba(0,0,0,0.9)"
              h="100%"
              w="100%"
            >
              {!isModalFullscreen && (
                <Box
                  w="100%"
                  h="100%"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                >
                  <Box
                    key={gameKey}
                    as="iframe"
                    src="https://html5-game-skatehive.vercel.app/QFShive/index.html"
                    w="1280px"
                    h="720px"
                    border="none"
                    title="SkateHive Game"
                    allow="fullscreen; autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                    transform={`scale(${gameScale})`}
                    transformOrigin="center"
                  />
                </Box>
              )}
              {isModalFullscreen && (
                <Box
                  w="100%"
                  h="100%"
                  bg="gray.800"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  color="gray.400"
                  fontSize="lg"
                >
                  Game is playing in fullscreen mode
                </Box>
              )}

              {/* Screen Reflection Effect */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)"
                pointerEvents="none"
              />
            </Box>
          </Box>

          {/* TV Control Panel */}
          <Box
            mt={4}
            bg="linear-gradient(135deg, #8B4513, #654321)"
            p={4}
            borderRadius="12px"
            border="2px solid #654321"
            boxShadow="inset 0 2px 8px rgba(0,0,0,0.3)"
            flexShrink={0}
          >
            <HStack justifyContent="space-between" alignItems="center">
              {/* Left Controls */}
              <HStack spacing={4}>
                <VStack spacing={2}>
                  <HStack spacing={2}>
                    <Circle
                      size="30px"
                      bg={mutedPrimary}
                      border={`2px solid ${mutedSecondary}`}
                    >
                      <Box w="20px" h="2px" bg="#654321" />
                    </Circle>
                    <Circle
                      size="30px"
                      bg={mutedPrimary}
                      border={`2px solid ${mutedSecondary}`}
                    >
                      <Box w="20px" h="2px" bg="#654321" />
                    </Circle>
                  </HStack>
                </VStack>

                {/* Pattern Display */}
                <Box
                  bg="black"
                  p={2}
                  borderRadius="4px"
                  border="1px solid #444"
                >
                  <HStack spacing={1}>
                    {[...Array(10)].map((_, i) => (
                      <Box
                        key={i}
                        w="3px"
                        h="15px"
                        bg={i % 2 === 0 ? mutedAccent : "#654321"}
                      />
                    ))}
                  </HStack>
                </Box>
              </HStack>

              {/* Center Controls */}
              <VStack spacing={2}>
                <HStack spacing={3}>
                  <Button
                    colorScheme="gray"
                    size="lg"
                    leftIcon={<Icon as={MdFullscreen} />}
                    onClick={toggleModalFullscreen}
                    bg={mutedPrimary}
                    color="white"
                    _hover={{ bg: mutedHighlight }}
                    fontWeight="bold"
                    border={`2px solid ${mutedSecondary}`}
                    boxShadow="0 4px 8px rgba(0,0,0,0.3)"
                  >
                    {isModalFullscreen ? "EXIT" : "FULLSCREEN"}
                  </Button>
                  <Button
                    colorScheme="gray"
                    size="lg"
                    leftIcon={<Icon as={MdRefresh} />}
                    onClick={refreshGame}
                    bg={mutedPrimary}
                    color="white"
                    _hover={{ bg: mutedHighlight }}
                    fontWeight="bold"
                    border={`2px solid ${mutedSecondary}`}
                    boxShadow="0 4px 8px rgba(0,0,0,0.3)"
                  >
                    REFRESH
                  </Button>
                  <Button
                    colorScheme="gray"
                    size="lg"
                    onClick={decreaseSize}
                    bg={mutedSecondary}
                    color="white"
                    _hover={{ bg: mutedHighlight }}
                    fontWeight="bold"
                    border={`2px solid ${mutedPrimary}`}
                    boxShadow="0 4px 8px rgba(0,0,0,0.3)"
                  >
                    -
                  </Button>
                  <Button
                    colorScheme="gray"
                    size="lg"
                    onClick={increaseSize}
                    bg={mutedSecondary}
                    color="white"
                    _hover={{ bg: mutedHighlight }}
                    fontWeight="bold"
                    border={`2px solid ${mutedPrimary}`}
                    boxShadow="0 4px 8px rgba(0,0,0,0.3)"
                  >
                    +
                  </Button>
                </HStack>
              </VStack>

              {/* Right Controls */}
              <HStack spacing={4}>
                {/* Pattern Display */}
                <Box
                  bg="black"
                  p={2}
                  borderRadius="4px"
                  border="1px solid #444"
                >
                  <HStack spacing={1}>
                    {[...Array(10)].map((_, i) => (
                      <Box
                        key={i}
                        w="3px"
                        h="15px"
                        bg={i % 2 === 0 ? mutedAccent : "#654321"}
                      />
                    ))}
                  </HStack>
                </Box>
                <VStack spacing={2}>
                  <HStack spacing={2}>
                    <Circle
                      size="30px"
                      bg={mutedPrimary}
                      border={`2px solid ${mutedSecondary}`}
                    >
                      <Box w="20px" h="2px" bg="#654321" />
                    </Circle>
                    <Circle
                      size="30px"
                      bg={mutedPrimary}
                      border={`2px solid ${mutedSecondary}`}
                    >
                      <Box w="20px" h="2px" bg="#654321" />
                    </Circle>
                  </HStack>
                </VStack>
              </HStack>
            </HStack>
          </Box>
        </Box>
      </Box>

      {/* Modal Fullscreen */}
      <Modal
        isOpen={isModalFullscreen}
        onClose={() => setIsModalFullscreen(false)}
        size="full"
        closeOnOverlayClick={false}
        motionPreset="none"
      >
        <ModalOverlay />
        <ModalContent
          bg="background"
          m={0}
          borderRadius={0}
          maxW="100vw"
          maxH="100vh"
          h="100vh"
          w="100vw"
          overflow="hidden"
        >
          <ModalCloseButton
            size="lg"
            color="white"
            bg="red.600"
            _hover={{ bg: "red.500" }}
            _active={{ bg: "red.700" }}
            borderRadius="lg"
            zIndex={10001}
            top={4}
            right={4}
            title="Exit Fullscreen (ESC)"
            boxShadow="xl"
            position="fixed"
          />
          <ModalBody
            p={0}
            h="100vh"
            w="100vw"
            position="relative"
            overflow="hidden"
          >
            <Box
              key={gameKey}
              as="iframe"
              src="https://html5-game-skatehive.vercel.app/QFShive/index.html"
              w="calc(100% + 200px)"
              h="calc(100% + 200px)"
              border="none"
              title="SkateHive Game - Fullscreen"
              allow="fullscreen; autoplay; encrypted-media"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              position="absolute"
              top="-100px"
              left="-100px"
              transform="scale(1.2)"
              transformOrigin="center"
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
