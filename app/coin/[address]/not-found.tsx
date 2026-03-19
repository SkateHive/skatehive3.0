'use client';

import {
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import Link from "next/link";
import { useTranslations } from '@/lib/i18n/hooks';

export default function NotFound() {
  const t = useTranslations('coinNotFound');
  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={8} textAlign="center">
        <VStack spacing={4}>
          <Heading size="2xl" color="gray.600">
            404
          </Heading>
          <Heading size="lg">{t('title')}</Heading>
        </VStack>

        <Alert status="warning" maxW="md">
          <AlertIcon />
          <VStack spacing={2} textAlign="left">
            <Text fontWeight="bold">{t('message')}</Text>
            <Text fontSize="sm">
              {t('description')}
            </Text>
          </VStack>
        </Alert>

        <VStack spacing={4}>
          <Text color="gray.600">
            {t('removedMessage')}
          </Text>

          <Button as={Link} href="/" colorScheme="blue" size="lg">
            {t('goHome')}
          </Button>
        </VStack>
      </VStack>
    </Container>
  );
}
