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
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import useHiveAccount from "@/hooks/useHiveAccount";
import useProfileData from "@/hooks/useProfileData";
import MainSettings from "@/components/settings/MainSettings";
import AdvancedSettings from "@/components/settings/AdvancedSettings";
import AssetsSettings from "@/components/settings/AssetsSettings";
import UserbaseAccountSettings from "@/components/settings/UserbaseAccountSettings";
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

  return (
    <Box minH="100vh" bg="background" color="primary">
      <Box maxW="container.md" mx="auto" px={6} py={12}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Heading size="xl" color="primary" mb={2}>
              {t('settings.title')}
            </Heading>
            <Text color="primary" fontSize="lg">
              {t('settings.subtitle')}
            </Text>
          </Box>

          {/* Tabs */}
          <Tabs
            index={activeTab}
            onChange={(index) => setActiveTab(index)}
            variant="enclosed"
            colorScheme="gray"
          >
            <TabList>
              <Tab
                _selected={{
                  color: "accent",
                  borderColor: "accent",
                  borderBottomColor: "background",
                  bg: "background",
                }}
                color="primary"
                fontWeight="semibold"
              >
                {t('settings.mainSettings')}
              </Tab>
              <Tab
                _selected={{
                  color: "accent",
                  borderColor: "accent",
                  borderBottomColor: "background",
                  bg: "background",
                }}
                color="primary"
                fontWeight="semibold"
              >
                {t('settings.appAccountTab')}
              </Tab>
              <Tab
                _selected={{
                  color: "accent",
                  borderColor: "accent",
                  borderBottomColor: "background",
                  bg: "background",
                }}
                color="primary"
                fontWeight="semibold"
              >
                {t('settings.assets')}
              </Tab>
              <Tab
                _selected={{
                  color: "accent",
                  borderColor: "accent",
                  borderBottomColor: "background",
                  bg: "background",
                }}
                color="primary"
                fontWeight="semibold"
              >
                {t('settings.advanced')}
              </Tab>
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
            </TabPanels>
          </Tabs>
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
