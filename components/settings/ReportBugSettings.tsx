"use client";
import React from "react";
import { Box, Text, VStack, Heading, Button, Icon } from "@chakra-ui/react";
import { FiFlag } from "react-icons/fi";
import { useReport } from "@/contexts/ReportContext";
import { useTranslations } from "@/contexts/LocaleContext";

const ReportBugSettings: React.FC = () => {
  const { openReport } = useReport();
  const t = useTranslations();

  return (
    <VStack spacing={4} align="stretch">
      <Box bg="background" border="1px solid" borderColor="muted" p={6}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              {t('settings.report.bugTitle')}
            </Heading>
            <Text color="primary" fontSize="sm">
              {t('settings.report.bugDescription')}
            </Text>
          </Box>
          <Button
            leftIcon={<Icon as={FiFlag} />}
            variant="outline"
            colorScheme="gray"
            alignSelf="flex-start"
            onClick={() => openReport({ type: "bug" })}
          >
            {t('settings.report.bugCta')}
          </Button>
        </VStack>
      </Box>

      <Box bg="background" border="1px solid" borderColor="muted" p={6}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              {t('settings.report.featureTitle')}
            </Heading>
            <Text color="primary" fontSize="sm">
              {t('settings.report.featureDescription')}
            </Text>
          </Box>
          <Button
            leftIcon={<Icon as={FiFlag} />}
            variant="outline"
            colorScheme="gray"
            alignSelf="flex-start"
            onClick={() => openReport({ type: "feature" })}
          >
            {t('settings.report.featureCta')}
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default ReportBugSettings;
