import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";

// Import themes
import forestTheme from "@/themes/forest";
import blueSkyTheme from "@/themes/bluesky";
import hackerTheme from "@/themes/hacker";
import hackerPlusTheme from "@/themes/hackerPlus";
import nounsDaoTheme from "@/themes/nounish";
import windows95Theme from "@/themes/windows95";
import hiveBRTheme from "@/themes/hivebr";
import cannabisTheme from "@/themes/cannabis";
import gayTheme from "@/themes/gay";
import hackerRedTheme from "@/themes/hackerRed";
import cyberpunkTheme from "@/themes/cyberpunk";
import retroPaperTheme from "@/themes/paper";
import limeTheme from "@/themes/lime";
import macTheme from "@/themes/mac";
import blackWhiteTheme from "@/themes/blackwhite";
import whiteBlackTheme from "@/themes/whiteblack";
import gruvboxNoggTheme from "@/themes/gruvbox-nogg";
import gruvboxNidTheme from "@/themes/gruvbox-nid";

// Available themes map
export const themeMap = {
  forest: forestTheme,
  bluesky: blueSkyTheme,
  hacker: hackerTheme,
  hackerPlus: hackerPlusTheme,
  hackerRed: hackerRedTheme,
  nounish: nounsDaoTheme,
  windows95: windows95Theme,
  hiveBR: hiveBRTheme,
  cannabis: cannabisTheme,
  gay: gayTheme,
  cyberpunk: cyberpunkTheme,
  paper: retroPaperTheme,
  lime: limeTheme,
  mac: macTheme,
  blackwhite: blackWhiteTheme,
  whiteblack: whiteBlackTheme,
  "gruvbox-nogg": gruvboxNoggTheme,
  "gruvbox-nid": gruvboxNidTheme,
};

export type ThemeName = keyof typeof themeMap;

interface ThemeContextProps {
  themeName: ThemeName;
  setThemeName: (themeName: ThemeName) => void;
  theme: any;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const defaultTheme =
    (process.env.NEXT_PUBLIC_THEME as ThemeName) || "hackerPlus";
  const [themeName, setThemeName] = useState<ThemeName>(
    themeMap[defaultTheme] ? defaultTheme : "hackerPlus"
  );
  const [theme, setTheme] = useState(themeMap[themeName]);

  useEffect(() => {
    // Load saved theme after mount to avoid hydration mismatch
    const savedThemeName = localStorage.getItem("theme") as ThemeName;
    if (
      savedThemeName &&
      themeMap[savedThemeName] &&
      savedThemeName !== themeName
    ) {
      setThemeName(savedThemeName);
      setTheme(themeMap[savedThemeName]);
    }
  }, [themeName]);

  const changeTheme = (newThemeName: ThemeName) => {
    setThemeName(newThemeName);
    setTheme(themeMap[newThemeName]);
    localStorage.setItem("theme", newThemeName);
  };

  // Extended theme with consistent dark mode and custom fonts
  const extendedTheme = extendTheme({
    ...theme,
    config: {
      initialColorMode: "dark",
      useSystemColorMode: false,
    },
    fonts: {
      ...theme.fonts,
      // Add Joystix as a custom font family that can be used with fontFamily="Joystix"
      Joystix: "'Joystix', 'VT323', 'Fira Mono', monospace",
      Mechanical: "'Mechanical', sans-serif",
      Tarrget3D: "'Tarrget3D', sans-serif",
    },
    styles: {
      global: {
        "html, body": {
          bg: "background",
          color: "text",
        },
        a: {
          color: "primary",
          textDecoration: "none",
          _hover: {
            color: "accent",
            textDecoration: "underline",
          },
          _visited: {
            color: "secondary",
          },
        },
        ".chakra-link": {
          color: "primary",
          _hover: {
            color: "accent",
          },
          _visited: {
            color: "secondary",
          },
        },
      },
    },
  });

  return (
    <ThemeContext.Provider
      value={{ themeName, setThemeName: changeTheme, theme }}
    >
      <ChakraProvider theme={extendedTheme}>{children}</ChakraProvider>
    </ThemeContext.Provider>
  );
};
