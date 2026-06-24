"use client";
import React, { useMemo, useState } from "react";
import {
  Box,
  Text,
  VStack,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon,
} from "@chakra-ui/react";
import { FiFlag, FiSettings, FiKey, FiTool } from "react-icons/fi";
import { FaWallet } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import useHiveAccount from "@/hooks/useHiveAccount";
import useProfileData from "@/hooks/useProfileData";
import MainSettings from "@/components/settings/MainSettings";
import AdvancedSettings from "@/components/settings/AdvancedSettings";
import AssetsSettings from "@/components/settings/AssetsSettings";
import UserbaseAccountSettings from "@/components/settings/UserbaseAccountSettings";
import ReportBugSettings from "@/components/settings/ReportBugSettings";
import { useTranslations } from "@/contexts/LocaleContext";

const Settings = () => {
  const t = useTranslations();
  const { user } = useAioha();
  const [activeTab, setActiveTab] = useState(0);

  // Memoize user data to prevent re-renders
  const userData = useMemo(
    () => ({
      hiveUsername:
        typeof user === "string" ? user : user?.name || user?.username,
      postingKey: typeof user === "object" ? user?.keys?.posting : undefined,
    }),
    [user]
  );

  // Get user's Hive account and profile data
  const { hiveAccount } = useHiveAccount(userData.hiveUsername || "");
  const { profileData } = useProfileData(
    userData.hiveUsername || "",
    hiveAccount
  );

  // Tab spec — keeps the JSX below tight and gives every tab an icon so
  // mobile users can recognise tabs even when the strip overflows.
  const tabSpec = [
    { icon: FiSettings, label: t("settings.mainSettings") },
    { icon: FiKey, label: t("settings.appAccountTab") },
    { icon: FaWallet, label: t("settings.assets") },
    { icon: FiTool, label: t("settings.advanced") },
    { icon: FiFlag, label: t("settings.reportBugTab") },
  ];

  const tabSelectedStyle = {
    color: "accent",
    borderColor: "accent",
    borderBottomColor: "background",
    bg: "background",
  } as const;

  return (
    <Box minH="100vh" bg="background" color="primary">
      <Box maxW="container.md" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 8, md: 12 }}>
        <VStack spacing={6} align="stretch">
          {/* Header — title + subtitle on a single line of visual hierarchy */}
          <Box textAlign="center" mb={2}>
            <Heading size="lg" color="primary" fontFamily="mono" mb={1}>
              {t('settings.title')}
            </Heading>
            <Text color="dim" fontSize="sm" fontFamily="mono">
              {t('settings.subtitle')}
            </Text>
          </Box>

          {/* Tabs — compact strip with icons for quick recognition */}
          <Tabs
            index={activeTab}
            onChange={(index) => setActiveTab(index)}
            variant="enclosed"
            colorScheme="gray"
          >
            <TabList
              overflowX="auto"
              flexWrap="nowrap"
              sx={{
                "&::-webkit-scrollbar": { display: "none" },
                scrollbarWidth: "none",
              }}
            >
              {tabSpec.map((tab) => (
                <Tab
                  key={tab.label}
                  _selected={tabSelectedStyle}
                  color="primary"
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="semibold"
                  px={3}
                  py={2}
                  whiteSpace="nowrap"
                >
                  <Icon as={tab.icon} mr={2} boxSize={3.5} />
                  {tab.label}
                </Tab>
              ))}
            </TabList>

            <TabPanels>
              <TabPanel px={0} py={6}>
                <MainSettings userData={userData} />
              </TabPanel>
              <TabPanel px={0} py={6}>
                <UserbaseAccountSettings />
              </TabPanel>
              <TabPanel px={0} py={6}>
                <AssetsSettings userData={userData} />
              </TabPanel>
              <TabPanel px={0} py={6}>
                <AdvancedSettings userData={userData} />
              </TabPanel>
              <TabPanel px={0} py={6}>
                <ReportBugSettings />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
