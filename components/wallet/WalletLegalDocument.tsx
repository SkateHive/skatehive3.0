import {
  Alert,
  AlertIcon,
  Box,
  Container,
  Divider,
  Heading,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from "@chakra-ui/react";
import { ReactNode } from "react";

export interface WalletLegalSection {
  title: string;
  paragraphs?: ReactNode[];
  items?: ReactNode[];
  footer?: ReactNode;
}

interface WalletLegalDocumentProps {
  title: string;
  lastUpdated: string;
  summary: ReactNode;
  sections: WalletLegalSection[];
}

export default function WalletLegalDocument({
  title,
  lastUpdated,
  summary,
  sections,
}: WalletLegalDocumentProps) {
  return (
    <Box bg="background" minH="100vh" py={12}>
      <Container maxW="4xl">
        <VStack spacing={6} p={8} align="stretch">
          <Box>
            <Heading
              as="h1"
              size="2xl"
              color="primary"
              borderBottom="4px solid"
              borderColor="secondary"
              pb={4}
              mb={4}
            >
              {title}
            </Heading>
            <Text color="gray.500" fontStyle="italic">
              Last updated: {lastUpdated}
            </Text>
          </Box>

          <Alert status="info" bg="secondary" color="black" rounded="md">
            <AlertIcon color="black" />
            <Text fontWeight="medium" color="black">
              <strong>TL;DR:</strong> {summary}
            </Text>
          </Alert>

          <Divider />

          {sections.map((section, index) => (
            <Box key={section.title}>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                {index + 1}. {section.title}
              </Heading>
              <VStack spacing={4} align="stretch">
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <Text key={paragraphIndex}>{paragraph}</Text>
                ))}
                {section.items && (
                  <UnorderedList spacing={2} pl={4}>
                    {section.items.map((item, itemIndex) => (
                      <ListItem key={itemIndex}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                )}
                {section.footer && <Text>{section.footer}</Text>}
              </VStack>
            </Box>
          ))}

          <Divider />

          <Box p={6} rounded="md" borderLeft="4px solid" borderColor="secondary">
            <Text mb={4}>Questions about Skatehive Wallet? Reach the crew:</Text>
            <VStack align="start" spacing={2}>
              <Text>
                <strong>Email:</strong> contact@skatehive.app
              </Text>
              <Text>
                <strong>Hive:</strong> @skatehive
              </Text>
              <Text>
                <strong>Discord:</strong> chat.skatehive.app
              </Text>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
