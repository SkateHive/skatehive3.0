import { Container, Heading, Text, VStack } from '@chakra-ui/react';
import { PoidhBountyList } from '@/components/bounties/PoidhBountyList';

export default function PoidhBountiesPage() {
  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={6} align="stretch">
        <VStack gap={2} align="start">
          <Heading size="xl">Skateboarding Bounties on Poidh 🛹</Heading>
          <Text color="textSecondary">
            Challenges and rewards from Base and Arbitrum
          </Text>
        </VStack>
        <PoidhBountyList />
      </VStack>
    </Container>
  );
}
