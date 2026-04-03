"use client";
import { Box, Text, VStack, useToken } from "@chakra-ui/react";
import { useEffect, useState, useRef } from "react";
import { useTranslations } from "../../contexts/LocaleContext";
import { useSoundSettings } from "../../contexts/SoundSettingsContext";
import OptimizedLoadingText from "./OptimizedLoadingText";
import { getFeature } from "@/lib/features";
import "../../lib/utils/fonts.css";

// Define character sets for each font
const matrixCharacters1 = "ABCDHIJKLMSTUVWXZ124567890"; // Logoskate1 (original, minus Logoskate2 chars)
const matrixCharacters2 = "EFGNOPQRYacfgkmopqrtwxz"; // Logoskate2 (user-specified)

// Array of translation keys for loading messages
const MESSAGE_KEYS = [
  'loadingMessages.fuckInstagram',
  'loadingMessages.praiseSkatevideosite',
  'loadingMessages.loadingStokenomics',
  'loadingMessages.initiatingProofOfStoke',
  'loadingMessages.loadFastAsDaryl',
  'loadingMessages.whoWasGnartoshi',
  'loadingMessages.takeBackInternet',
  'loadingMessages.getHigher',
  'loadingMessages.neverLoseClips',
  'loadingMessages.supportLocalShops',
  'loadingMessages.peoplesThrasher',
  'loadingMessages.stackHP',
  'loadingMessages.blessUp',
  'loadingMessages.ugandaNodes',
  'loadingMessages.connectionSucks',
  'loadingMessages.macbaLives',
  'loadingMessages.skateTillTired',
  'loadingMessages.hivePowerVotePower',
  'loadingMessages.lipslideToMoon',
  'loadingMessages.macbaLives',
  'loadingMessages.blessSkateshop',
  'loadingMessages.nobodyOwns',
  'loadingMessages.dropHills',
  'loadingMessages.praiseSkatevideosite',
  'loadingMessages.readyToGrind',
  'loadingMessages.ctrlKMenu',
  'loadingMessages.skateboardHivemind',
];

// Generate a column as an array of { char, font }
function generateColumnArray(lines = 50) {
  let column = [];
  for (let i = 0; i < lines; i++) {
    // 70% chance Logoskate1, 30% Logoskate2
    if (Math.random() < 0.3) {
      const char =
        matrixCharacters2[Math.floor(Math.random() * matrixCharacters2.length)];
      column.push({ char, font: "Logoskate2" });
    } else {
      const char =
        matrixCharacters1[Math.floor(Math.random() * matrixCharacters1.length)];
      column.push({ char, font: "Logoskate" });
    }
  }
  return column;
}

// New: type for column
interface MatrixColumn {
  text: { char: string; font: string }[];
  duration: number;
  delay: number;
}

const LogoMatrix = () => {
  const t = useTranslations();
  const { soundEnabled } = useSoundSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  
  const [currentMessageKey, setCurrentMessageKey] = useState(MESSAGE_KEYS[0]);
  const [columns, setColumns] = useState<MatrixColumn[]>([]);
  const [primary] = useToken("colors", ["primary"]);
  const [messageVisible, setMessageVisible] = useState(true);

  // Keep ref in sync with soundEnabled
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Play loading sound on mount - preload and play when ready
  useEffect(() => {
    const audio = new Audio('/loadindsfx.mp3');
    audio.volume = 0.3;
    audioRef.current = audio;
    
    const playWhenReady = () => {
      if (soundEnabledRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {
          // Silently fail if audio can't be played
        });
      }
    };

    // If already loaded, play immediately
    if (audio.readyState >= 3) {
      playWhenReady();
    } else {
      audio.addEventListener('canplaythrough', playWhenReady, { once: true });
    }

    return () => {
      audio.removeEventListener('canplaythrough', playWhenReady);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Only generate columns once on mount
  useEffect(() => {
    const randomKey = MESSAGE_KEYS[Math.floor(Math.random() * MESSAGE_KEYS.length)];
    setCurrentMessageKey(randomKey);
    const newColumns = Array.from({ length: 20 }, () => ({
      text: generateColumnArray(50),
      duration: 10 + Math.random() * 10, // 10-20s
      delay: -Math.random() * 2, // -0 to -2s
    }));
    setColumns(newColumns);
  }, []);

  // Only update the random sentence on interval
  useEffect(() => {
    const switchMessage = setInterval(() => {
      setMessageVisible(false);
      setTimeout(() => {
        setCurrentMessageKey((prev) => {
          let next;
          do {
            next = MESSAGE_KEYS[Math.floor(Math.random() * MESSAGE_KEYS.length)];
          } while (next === prev && MESSAGE_KEYS.length > 1);
          return next;
        });
        setMessageVisible(true);
      }, 400); // fade out for 400ms, then switch and fade in
    }, 4000);
    return () => clearInterval(switchMessage);
  }, []);
  
  const randomSentence = t(currentMessageKey);

  return (
    <div lang="en">
      <VStack
        bg="transparent"
        overflowY="hidden"
        css={{ "&::-webkit-scrollbar": { display: "none" } }}
        width="100%"
        height="100vh"
        justify="center"
        align="center"
        position="relative"
      >
        {columns.map((col, i) => (
          <Box
            key={i}
            position="absolute"
            top="-150vh"
            left={`${(100 / 20) * i}%`}
            w="5%"
            color={primary}
            fontSize="18px"
            lineHeight="1.2"
            whiteSpace="pre"
            style={{
              animation: `matrixFall ${col.duration}s linear ${col.delay}s infinite`,
            }}
          >
            {col.text.map((item, idx) => (
              <span
                key={idx}
                style={{ fontFamily: `'${item.font}', monospace` }}
              >
                {item.char + "\n"}
              </span>
            ))}
          </Box>
        ))}
        {getFeature('PRETEXT_VIRTUAL_SCROLL') ? (
          <OptimizedLoadingText
            text={randomSentence}
            color={primary}
            isVisible={messageVisible}
          />
        ) : (
          <Text
            position="relative"
            zIndex={1}
            color={primary}
            fontSize={["20px", "28px", "40px", "40px"]}
            textAlign="center"
            fontFamily="'Joystix', monospace"
            p={[2, 3, 4]}
            borderRadius="none"
            opacity={messageVisible ? 1 : 0}
            transition="opacity 0.4s"
            maxW={["90vw", "80vw", "50vw", "40vw"]}
            mx="auto"
            _before={{
              content: `"${randomSentence}"`,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%",
              height: "100%",
              background: `linear-gradient(to right, ${primary}, #fff)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation:
                "ghost-glitch 1.5s infinite, ghost-flicker 1.1s infinite, ghost-stretch 2.5s infinite",
              clipPath: "inset(2px 0)",
              opacity: 0.2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              transformOrigin: "center center",
            }}
          >
            {randomSentence}
          </Text>
        )}
        <style jsx global>{`
          @font-face {
            font-family: "Logoskate";
            src: url("/fonts/Logoskate.woff2") format("woff2");
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: "Logoskate2";
            src: url("/fonts/Logoskate2.woff2") format("woff2");
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: "Joystix";
            src: url("/fonts/joystix.woff2") format("woff2"),
              url("/fonts/joystix.woff") format("woff"),
              url("/fonts/joystix.otf") format("opentype");
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          @keyframes matrixFall {
            0% {
              transform: translateY(0);
            }
            100% {
              transform: translateY(350vh);
            }
          }
          @keyframes ghost-glitch {
            0%,
            100% {
              transform: translate(-50%, -50%) skew(0deg);
            }
            10%,
            90% {
              transform: translate(-50%, -50%) skew(0deg);
            }
            15% {
              transform: translate(-53%, -48%) skew(25deg);
            }
            25% {
              transform: translate(-47%, -51%) skew(-15deg);
            }
            35% {
              transform: translate(-52%, -53%) skew(5deg);
            }
            45% {
              transform: translate(-48%, -47%) skew(-25deg);
            }
            55% {
              transform: translate(-51%, -52%) skew(15deg);
            }
            65% {
              transform: translate(-47%, -48%) skew(-5deg);
            }
            75% {
              transform: translate(-53%, -51%) skew(20deg);
            }
          }
          @keyframes ghost-flicker {
            0% {
              opacity: 0.2;
            }
            7% {
              opacity: 0;
            }
            13% {
              opacity: 0.3;
            }
            19% {
              opacity: 0.1;
            }
            27% {
              opacity: 0.4;
            }
            33% {
              opacity: 0;
            }
            41% {
              opacity: 0.2;
            }
            52% {
              opacity: 0.05;
            }
            60% {
              opacity: 0.3;
            }
            68% {
              opacity: 0;
            }
            75% {
              opacity: 0.25;
            }
            82% {
              opacity: 0.1;
            }
            90% {
              opacity: 0.3;
            }
            100% {
              opacity: 0.2;
            }
          }
          @keyframes ghost-stretch {
            0%,
            100% {
              transform: translate(-50%, -50%) scaleY(1);
            }
            25% {
              transform: translate(-50%, -50%) scaleY(1.4);
            }
            35% {
              transform: translate(-50%, -50%) scaleY(0.8);
            }
            45% {
              transform: translate(-50%, -50%) scaleY(1.2);
            }
            55% {
              transform: translate(-50%, -50%) scaleY(0.9);
            }
            65% {
              transform: translate(-50%, -50%) scaleY(1.1);
            }
            75% {
              transform: translate(-50%, -50%) scaleY(1);
            }
          }
        `}</style>
      </VStack>
    </div>
  );
};

export default LogoMatrix;
