import { Metadata } from "next";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  UnorderedList,
  ListItem,
  Alert,
  AlertIcon,
  Divider,
} from "@chakra-ui/react";

export const metadata: Metadata = {
  title: "Privacy Policy | SkatHive",
  description:
    "SkatHive Privacy Policy - Learn how we protect your privacy on the decentralized Hive blockchain.",
};

export default function PrivacyPolicyPage() {
  return (
    <Box bg="background" minH="100vh" py={12}>
      <Container maxW="4xl">
        <Box bg="background" shadow="lg" rounded="lg" overflow="hidden">
          <VStack spacing={6} p={8} align="stretch">
            {/* Header */}
            <Box>
              <Heading
                as="h1"
                size="2xl"
                color="primary"
                borderBottom="4px solid"
                borderColor="secondary"
                pb={4}
                mb={4}
                bg={"background"}
              >
                SkatHive Privacy Policy
              </Heading>
              <Text color="gray.600" fontStyle="italic" mb={6}>
                Last updated: October 26, 2025
              </Text>
            </Box>

            {/* TL;DR Alert */}
            <Alert status="info" bg="secondary" color="white" rounded="md">
              <AlertIcon color="white" />
              <Text fontWeight="medium">
                <strong>TL;DR:</strong> SkatHive doesn&apos;t collect, store, or
                sell your personal data. Everything is stored on the
                decentralized Hive blockchain, giving you full control and
                ownership of your content.
              </Text>
            </Alert>

            <Divider />

            {/* Section 1 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                1. Introduction
              </Heading>
              <VStack spacing={4} align="stretch">
                <Text>
                  SkatHive (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
                  is committed to protecting your privacy. This Privacy Policy
                  explains how we handle information when you use our mobile
                  application (the &quot;App&quot;) to interact with the Hive
                  blockchain and connect with the skateboarding community.
                </Text>
                <Text>
                  Our fundamental principle is simple: we don&apos;t collect,
                  store, or control your personal data. SkatHive is built on the
                  decentralized Hive blockchain, which means your data belongs
                  to you and is stored on a distributed network, not on our
                  servers.
                </Text>
              </VStack>
            </Box>

            {/* Section 2 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                2. Information We Do NOT Collect
              </Heading>
              <Text mb={4}>
                Unlike traditional social media platforms, SkatHive does NOT
                collect:
              </Text>
              <UnorderedList spacing={2} pl={4}>
                <ListItem>
                  Personal identification information (name, email, phone
                  number)
                </ListItem>
                <ListItem>Device identifiers or tracking information</ListItem>
                <ListItem>Location data</ListItem>
                <ListItem>Browsing history or usage analytics</ListItem>
                <ListItem>Contact lists or social connections</ListItem>
                <ListItem>Biometric data</ListItem>
                <ListItem>
                  Any data for advertising or marketing purposes
                </ListItem>
              </UnorderedList>
            </Box>

            {/* Section 3 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                3. How the App Works
              </Heading>
              <Text mb={4}>
                SkatHive is a decentralized application (dApp) that interfaces
                directly with the Hive blockchain. When you use the app:
              </Text>
              <UnorderedList spacing={2} pl={4}>
                <ListItem>
                  Your content (skateboarding photos, videos, posts) is stored
                  on the Hive blockchain
                </ListItem>
                <ListItem>
                  Your Hive account credentials are stored locally on your
                  device
                </ListItem>
                <ListItem>
                  All interactions happen directly between your device and the
                  blockchain
                </ListItem>
                <ListItem>
                  We do not have access to your private keys or personal content
                </ListItem>
              </UnorderedList>
            </Box>

            {/* Section 4 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                4. Blockchain Data
              </Heading>
              <Text mb={4}>
                When you post content through SkatHive, that content becomes
                part of the public Hive blockchain. This means:
              </Text>
              <UnorderedList spacing={2} pl={4}>
                <ListItem>
                  Your posts, comments, and votes are publicly visible
                </ListItem>
                <ListItem>
                  This data is permanently stored on the blockchain
                </ListItem>
                <ListItem>
                  Anyone can access this information through various Hive
                  frontends
                </ListItem>
                <ListItem>
                  You maintain full ownership and control of your content
                </ListItem>
              </UnorderedList>
            </Box>

            {/* Section 5 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                5. Local Device Storage
              </Heading>
              <Text mb={4}>
                The app may store the following information locally on your
                device:
              </Text>
              <UnorderedList spacing={2} pl={4} mb={4}>
                <ListItem>Your Hive account credentials (encrypted)</ListItem>
                <ListItem>App preferences and settings</ListItem>
                <ListItem>Cached content for improved performance</ListItem>
              </UnorderedList>
              <Text>
                This information never leaves your device and is not transmitted
                to us or any third parties.
              </Text>
            </Box>

            {/* Section 6 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                6. Third-Party Services
              </Heading>
              <Text mb={4}>SkatHive may interact with:</Text>
              <UnorderedList spacing={2} pl={4} mb={4}>
                <ListItem>
                  Hive blockchain nodes: To read and write blockchain data
                </ListItem>
                <ListItem>
                  IPFS or similar services: For decentralized media storage
                </ListItem>
                <ListItem>
                  App stores: For app distribution and updates
                </ListItem>
              </UnorderedList>
              <Text>
                These services have their own privacy policies, and we encourage
                you to review them.
              </Text>
            </Box>

            {/* Section 7 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                7. Camera and Media Access
              </Heading>
              <Text mb={4}>
                The app requests permission to access your device&apos;s camera
                and photo library solely to:
              </Text>
              <UnorderedList spacing={2} pl={4} mb={4}>
                <ListItem>
                  Take photos and videos of skateboarding content for posting
                </ListItem>
                <ListItem>Select existing media from your device</ListItem>
              </UnorderedList>
              <Text>
                This access is used only when you actively choose to share
                content. We do not access your media library without your
                explicit action.
              </Text>
            </Box>

            {/* Section 8 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                8. Data Security
              </Heading>
              <Text mb={4}>
                Since we don&apos;t collect or store your personal data,
                there&apos;s no centralized database that could be compromised.
                Your security depends on:
              </Text>
              <UnorderedList spacing={2} pl={4}>
                <ListItem>
                  Keeping your Hive account credentials secure
                </ListItem>
                <ListItem>Using strong passwords</ListItem>
                <ListItem>
                  Protecting your device from unauthorized access
                </ListItem>
              </UnorderedList>
            </Box>

            {/* Section 9 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                9. Children&apos;s Privacy
              </Heading>
              <Text>
                SkatHive is not intended for children under 13. We do not
                knowingly collect personal information from children under 13.
                The app should only be used by individuals who are at least 13
                years old.
              </Text>
            </Box>

            {/* Section 10 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                10. Changes to This Privacy Policy
              </Heading>
              <Text>
                We may update this Privacy Policy from time to time. We will
                notify users of any material changes by posting the new Privacy
                Policy on this page and updating the &quot;Last updated&quot;
                date.
              </Text>
            </Box>

            {/* Section 11 */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                11. Your Rights
              </Heading>
              <Text mb={4}>
                Because we don&apos;t collect your personal data, traditional
                data protection rights (like deletion requests) don&apos;t apply
                to us. However, you have complete control over:
              </Text>
              <UnorderedList spacing={2} pl={4}>
                <ListItem>Your Hive account and its content</ListItem>
                <ListItem>What you choose to share on the blockchain</ListItem>
                <ListItem>
                  Your local app data (which you can delete by uninstalling the
                  app)
                </ListItem>
              </UnorderedList>
            </Box>

            {/* Section 12 - Contact */}
            <Box>
              <Heading as="h2" size="lg" color="primary" mb={4}>
                12. Contact Us
              </Heading>
              <Box
                p={6}
                rounded="md"
                borderLeft="4px solid"
                borderColor="secondary"
              >
                <Text mb={4}>
                  If you have any questions about this Privacy Policy or
                  SkatHive, please contact us:
                </Text>
                <VStack align="start" spacing={2}>
                  <Text>
                    <strong>Email:</strong> contact@skatehive.app
                  </Text>
                  <Text>
                    <strong>GitHub:</strong> github.com/SkateHive/skatehive3.0
                  </Text>
                  <Text>
                    <strong>Hive:</strong> @skatehive
                  </Text>
                  <Text>
                    <strong>Discord:</strong> discord.gg/gJxxSxswUv
                  </Text>
                </VStack>
              </Box>
            </Box>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}
