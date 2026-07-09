"use client";
import { Box, Center, Image } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Set a minimum display time for the splash screen
    const minDisplayTime = setTimeout(() => {
      if (document.readyState === "complete") {
        handleComplete();
      }
    }, 1200);

    const handleComplete = () => {
      setFadeOut(true);
      setTimeout(() => {
        setShow(false);
        onFinish();
      }, 500); // Match this with the CSS transition time
    };

    if (document.readyState === "complete") {
      // If already loaded, start the min display timer
      // (don't immediately hide)
    } else {
      window.addEventListener("load", handleComplete);
    }

    return () => {
      clearTimeout(minDisplayTime);
      window.removeEventListener("load", handleComplete);
    };
  }, [onFinish]);

  if (!show) return null;

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      width="100vw"
      height="100vh"
      background="#000"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex="9999"
      opacity={fadeOut ? 0 : 1}
      transition="opacity 0.5s ease"
    >
      <Center flexDirection="column">
        <Image
          src="/SKATE_HIVE_VECTOR_FIN.svg"
          alt="Skatehive Logo"
          width="250px"
        />
      </Center>
    </Box>
  );
}
