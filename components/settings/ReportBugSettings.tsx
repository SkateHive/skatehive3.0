"use client";
import React from "react";
import { Box, Text, VStack, Heading, Button, Icon } from "@chakra-ui/react";
import { FiFlag } from "react-icons/fi";
import { useReport } from "@/contexts/ReportContext";

const ReportBugSettings: React.FC = () => {
  const { openReport } = useReport();

  return (
    <VStack spacing={4} align="stretch">
      <Box bg="background" border="1px solid" borderColor="muted" p={6}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              Report a Bug
            </Heading>
            <Text color="primary" fontSize="sm">
              Found something broken? Let us know and we&apos;ll fix it as soon as possible.
            </Text>
          </Box>
          <Button
            leftIcon={<Icon as={FiFlag} />}
            colorScheme="red"
            variant="outline"
            alignSelf="flex-start"
            onClick={() => openReport({ type: "bug" })}
          >
            Open Report Form
          </Button>
        </VStack>
      </Box>

      <Box bg="background" border="1px solid" borderColor="muted" p={6}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="md" color="primary" mb={1}>
              Feature Request
            </Heading>
            <Text color="primary" fontSize="sm">
              Have an idea to improve Skatehive? We&apos;d love to hear it.
            </Text>
          </Box>
          <Button
            leftIcon={<Icon as={FiFlag} />}
            colorScheme="green"
            variant="outline"
            alignSelf="flex-start"
            onClick={() => openReport({ type: "feature" })}
          >
            Submit Feature Request
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default ReportBugSettings;
