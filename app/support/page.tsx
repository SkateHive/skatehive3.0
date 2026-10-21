"use client";
import React, { useState } from "react";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Flex,
  Icon,
  Divider,
  SimpleGrid,
  Card,
  CardBody,
  Link,
} from "@chakra-ui/react";
import { APP_CONFIG } from "@/config/app.config";
import { useTranslations } from "@/lib/i18n/hooks";

import {
  FaEnvelope,
  FaQuestionCircle,
  FaBug,
  FaLightbulb,
  FaExternalLinkAlt,
  FaCheckCircle,
} from "react-icons/fa";

interface FormData {
  email: string;
  message: string;
  subject: string;
}

interface FormErrors {
  email?: string;
  message?: string;
  general?: string;
}

export default function SupportPage() {
  const t = useTranslations('support');
  const [formData, setFormData] = useState<FormData>({
    email: "",
    message: "",
    subject: t('accountLoginTitle'),
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = t('emailRequired');
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = t('emailInvalid');
    }

    // Message validation
    if (!formData.message) {
      newErrors.message = t('messageRequired');
    } else if (formData.message.length < 10) {
      newErrors.message = t('messageShort');
    } else if (formData.message.length > 2000) {
      newErrors.message = t('messageTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSubmitted(true);
        setFormData({
          email: "",
          message: "",
          subject: "General Support Request",
        });
      } else {
        setErrors({
          general: result.error || t('generalError'),
        });
      }
    } catch (error) {
      setErrors({
        general: t('networkError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Common support topics
  const supportTopics = [
    {
      icon: FaQuestionCircle,
      title: t('accountLoginTitle'),
      description: t('accountLoginDesc'),
      color: "blue.500",
    },
    {
      icon: FaBug,
      title: t('technicalIssuesTitle'),
      description: t('technicalIssuesDesc'),
      color: "red.500",
    },
    {
      icon: FaLightbulb,
      title: t('featureRequestsTitle'),
      description: t('featureRequestsDesc'),
      color: "yellow.500",
    },
    {
      icon: FaEnvelope,
      title: t('generalQuestionsTitle'),
      description: t('generalQuestionsDesc'),
      color: "green.500",
    },
  ];

  if (isSubmitted) {
    return (
      <Container maxW="container.md" py={8}>
        <VStack spacing={6} textAlign="center">
          <Icon as={FaCheckCircle} boxSize={16} color="green.500" />
          <Heading size="lg" color="green.500">
            {t('successTitle')}
          </Heading>
          <Text color="gray.600" fontSize="lg">
            {t('successMessage')}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {t('successEmail')}
          </Text>
          <Button
            colorScheme="green"
            onClick={() => setIsSubmitted(false)}
            size="lg"
          >
            {t('sendAnother')}
          </Button>
        </VStack>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg={"background"}>
      <Container maxW="container.lg" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center">
            <Heading size="xl" mb={4} color="primary">
              {t('pageTitle')}
            </Heading>
            <Text fontSize="lg" color="gray.600" maxW="2xl" mx="auto">
              {t('pageSubtitle')}
            </Text>
          </Box>

          {/* Support Topics */}
          <Box>
            <Heading size="md" mb={4} textAlign="center">
              {t('topicsHeader')}
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={8}>
              {supportTopics.map((topic, index) => (
                <Card
                  key={index}
                  bg={"background"}
                  borderColor={"primary"}
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "lg",
                    borderColor: topic.color,
                  }}
                  transition="all 0.2s"
                  cursor="pointer"
                  onClick={() => handleInputChange("subject", topic.title)}
                >
                  <CardBody>
                    <Flex align="center" mb={3}>
                      <Icon
                        as={topic.icon}
                        color={topic.color}
                        boxSize={6}
                        mr={3}
                      />
                      <Text fontWeight="bold" fontSize="lg">
                        {topic.title}
                      </Text>
                    </Flex>
                    <Text color="primary" fontSize="sm">
                      {topic.description}
                    </Text>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </Box>

          <Divider />

          {/* Contact Form */}
          <Box>
            <Heading size="md" mb={6} textAlign="center">
              {t('sendMessageHeader')}
            </Heading>

            {errors.general && (
              <Alert status="error" mb={6} borderRadius="md">
                <AlertIcon />
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}

            <Card bg={"background"} borderColor={"primary"}>
              <CardBody>
                <form onSubmit={handleSubmit}>
                  <VStack spacing={6} align="stretch">
                    <FormControl isRequired isInvalid={!!errors.email}>
                      <FormLabel fontWeight="medium">{t('emailLabel')}</FormLabel>
                      <Input
                        type="email"
                        placeholder={t('emailPlaceholder')}
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        size="lg"
                        bg={"background"}
                        borderColor={errors.email ? "red.300" : "gray.300"}
                        _focus={{
                          borderColor: "primary",
                          boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
                        }}
                      />
                      {errors.email && (
                        <Text color="red.500" fontSize="sm" mt={1}>
                          {errors.email}
                        </Text>
                      )}
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {t('emailHelp')}
                      </Text>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontWeight="medium">{t('subjectLabel')}</FormLabel>
                      <Input
                        placeholder={t('subjectPlaceholder')}
                        value={formData.subject}
                        onChange={(e) =>
                          handleInputChange("subject", e.target.value)
                        }
                        size="lg"
                        bg={"background"}
                        _focus={{
                          borderColor: "primary",
                          boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
                        }}
                      />
                    </FormControl>

                    <FormControl isRequired isInvalid={!!errors.message}>
                      <FormLabel fontWeight="medium">
                        {t('messageLabel')}
                      </FormLabel>
                      <Textarea
                        placeholder={t('messagePlaceholder')}
                        value={formData.message}
                        onChange={(e) =>
                          handleInputChange("message", e.target.value)
                        }
                        rows={6}
                        resize="vertical"
                        bg={"background"}
                        borderColor={errors.message ? "red.300" : "gray.300"}
                        _focus={{
                          borderColor: "primary",
                          boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
                        }}
                      />
                      {errors.message && (
                        <Text color="red.500" fontSize="sm" mt={1}>
                          {errors.message}
                        </Text>
                      )}
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {formData.message.length}{t('characterCount')}
                      </Text>
                    </FormControl>

                    <Button
                      type="submit"
                      colorScheme="green"
                      size="lg"
                      isLoading={isSubmitting}
                      loadingText={t('sendingButton')}
                      disabled={!formData.email || !formData.message}
                      width="full"
                    >
                      {t('sendButton')}
                    </Button>
                  </VStack>
                </form>
              </CardBody>
            </Card>
          </Box>

          {/* Additional Resources */}
          <Box textAlign="center" pt={4}>
            <Text color="gray.600" mb={4}>
              {t('resourcesHeader')}
            </Text>
            <Flex justify="center" wrap="wrap" gap={4}>
              <Link
                href="https://docs.skatehive.app"
                isExternal
                color="primary"
                fontWeight="medium"
                _hover={{ textDecoration: "underline" }}
              >
                {t('documentationLink')} <Icon as={FaExternalLinkAlt} ml={1} boxSize={3} />
              </Link>
              <Link
                href="https://discord.gg/gJxxSxswUv"
                isExternal
                color="primary"
                fontWeight="medium"
                _hover={{ textDecoration: "underline" }}
              >
                {t('discordLink')}{" "}
                <Icon as={FaExternalLinkAlt} ml={1} boxSize={3} />
              </Link>
              <Link
                href={`${APP_CONFIG.BASE_URL}/blog`}
                isExternal
                color="primary"
                fontWeight="medium"
                _hover={{ textDecoration: "underline" }}
              >
                {t('updatesLink')}{" "}
                <Icon as={FaExternalLinkAlt} ml={1} boxSize={3} />
              </Link>
            </Flex>
          </Box>

          {/* Response Time Notice */}
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>{t('responseTimeTitle')}</AlertTitle>
              <AlertDescription>
                {t('responseTimeMessage')}
              </AlertDescription>
            </Box>
          </Alert>
        </VStack>
      </Container>
    </Box>
  );
}
