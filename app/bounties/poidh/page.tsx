import { Container, Heading, VStack } from '@chakra-ui/react';
import { PoidhBountyList } from '@/components/bounties/PoidhBountyList';

export default function PoidhBountiesPage() {
  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={8} align="stretch">
        <Heading size="xl">POIDH Bounties (Base)</Heading>
        <PoidhBountyList />
      </VStack>
    </Container>
  );
}
