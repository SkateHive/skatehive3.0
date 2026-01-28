"use client";
import React from "react";
import {
  Box,
  Select,
  Text,
  useToast,
  VStack,
  Heading,
  Switch,
  HStack,
} from "@chakra-ui/react";
import { useTheme, ThemeName, themeMap } from "@/app/themeProvider";
import VoteWeightSlider from "@/components/settings/VoteWeightSlider";
import { useTranslations } from "@/contexts/LocaleContext";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";
import { useLocale } from "@/contexts/LocaleContext";
import { localeNames, Locale, locales } from "@/lib/i18n/translations";

interface MainSettingsProps {
  userData: {
    hiveUsername: string | undefined;
    postingKey: string | undefined;
  };
}

const MainSettings: React.FC<MainSettingsProps> = ({ userData }) => {
  const t = useTranslations();
  const { themeName, setThemeName } = useTheme();
  const { soundEnabled, setSoundEnabled, isHydrated } = useSoundSettings();
  const { locale, setLocale } = useLocale();
  const toast = useToast();

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = event.target.value as ThemeName;
    setThemeName(newTheme);
    toast({
      title: t('settings.themeUpdated'),
      description: t('settings.themeSwitched').replace('{theme}', newTheme),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  const handleSoundToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSoundEnabled(event.target.checked);
    toast({
      title: t('settings.soundUpdated'),
      description: event.target.checked ? t('settings.soundEnabled') : t('settings.soundDisabled'),
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value as Locale;
    setLocale(newLocale);
    toast({
      title: t('settings.languageUpdated'),
      description: t('settings.languageSwitched'),
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  // Format theme name for display
  const formatThemeName = (name: string) => {
    return name
      .split(/(?=[A-Z])|[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <VStack spacing={8} align="stretch">

      {/* Language Selection Card */}
      <Box
        bg="background"
        border="1px solid"
        borderColor="muted"
        p={6}
        shadow="sm"
      >
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              {t('settings.language')}
            </Heading>
            <Text color="primary" fontSize="sm">
              {t('settings.languageDescription')}
            </Text>
          </Box>
          <Select
            value={locale}
            onChange={handleLanguageChange}
            size="lg"
            bg="background"
            color="primary"
            borderColor="muted"
            borderWidth="2px"
            fontWeight="semibold"
            _focus={{
              borderColor: "accent",
              boxShadow: "0 0 0 3px rgba(var(--chakra-colors-accent), 0.1)",
              outline: "none",
            }}
            _hover={{ borderColor: "accent" }}
            sx={{
              option: {
                background: "var(--chakra-colors-background)",
                color: "var(--chakra-colors-primary)",
              },
            }}
          >
            {locales.map((loc) => (
              <option key={loc} value={loc}>
                {localeNames[loc]}
              </option>
            ))}
          </Select>
        </VStack>
      </Box>

      {/* Sound Effects Card */}
      <Box
        bg="background"
        border="1px solid"
        borderColor="muted"
        p={6}
        shadow="sm"
      >
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              {t('settings.soundEffects')}
            </Heading>
            <Text color="primary" fontSize="sm">
              {t('settings.soundEffectsDescription')}
            </Text>
          </Box>
          <HStack spacing={3} justify="space-between">
            <Text color="primary" fontWeight="medium">
              {t('settings.clickSoundLabel')}
            </Text>
            <Switch
              isChecked={isHydrated ? soundEnabled : true}
              onChange={handleSoundToggle}
              colorScheme="blue"
              size="lg"
            />
          </HStack>
        </VStack>
      </Box>

      {/* Theme Selection Card */}
      <Box
        bg="background"
        border="1px solid"
        borderColor="muted"
        p={6}
        shadow="sm"
      >
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              {t('settings.themeSelection')}
            </Heading>
            <Text color="primary" fontSize="sm">
              {t('settings.themeDescription')}
            </Text>
          </Box>
          <Select
            value={themeName}
            onChange={handleThemeChange}
            size="lg"
            bg="background"
            color="primary"
            borderColor="muted"
            borderWidth="2px"
            fontWeight="semibold"
            _focus={{
              borderColor: "accent",
              boxShadow: "0 0 0 3px rgba(var(--chakra-colors-accent), 0.1)",
              outline: "none",
            }}
            _hover={{ borderColor: "accent" }}
            sx={{
              option: {
                background: "var(--chakra-colors-background)",
                color: "var(--chakra-colors-primary)",
              },
            }}
          >
            {Object.keys(themeMap).map((theme) => (
              <option key={theme} value={theme}>
                {formatThemeName(theme)}
              </option>
            ))}
          </Select>
        </VStack>
      </Box>

      {/* Vote Weight Slider */}
      {userData.hiveUsername && (
        <VoteWeightSlider
          username={userData.hiveUsername}
          onVoteWeightUpdate={(voteWeight) => {
            // Vote weight updated
          }}
        />
      )}

      {/* Community Section */}
      {userData.hiveUsername && (
        <Box
          bg="background"
          border="1px solid"
          borderColor="muted"
          p={6}
          shadow="sm"
        >
          <VStack spacing={4} align="stretch">
            <Box>
              <Heading size="md" color="primary" mb={1}>
                {t('settings.community')}
              </Heading>
              <Text color="primary" fontSize="sm">
                {t('settings.communityDescription')}
              </Text>
            </Box>
          </VStack>
        </Box>
      )}


    </VStack>
  );
};

export default MainSettings;
