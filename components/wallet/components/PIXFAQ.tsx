import { useState } from 'react';
import { Box, Heading, Text, IconButton } from '@chakra-ui/react';
import { FaGlobe } from 'react-icons/fa';

const PIXFAQ = () => {
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');

  const content = {
    en: {
      title: '❓ FAQ',
      question: 'What should I do if my transfer doesn’t work?',
      answer: [
        'Stay calm, it will arrive or we will refund you.',
        'Our team always receives notifications of transactions in case of failure.',
        'If you wish, open a support ticket on our <a href="https://discord.gg/eAQfS97wHK">Discord channel</a>.',
      ],
    },
    pt: {
      title: '❓ FAQ',
      question: 'O que eu faço caso minha transferência não funcione?',
      answer: [
        'Calma, ele vai chegar ou vamos te reembolsar.',
        'Nosso time sempre recebe notificações das transações em caso de falha.',
        'Caso queira, abra um ticket de suporte em nosso <a href="https://discord.gg/eAQfS97wHK">Discord</a>.',
      ],
    },
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'pt' : 'en');
  };

  return (
    <Box
      p={4}
      bg="background"
      borderRadius="lg"
      border="1px solid"
      borderColor="muted"
      position="relative"
    >
      <IconButton
        aria-label="Toggle language"
        icon={<FaGlobe />}
        size="sm"
        position="absolute"
        top={2}
        right={2}
        onClick={toggleLanguage}
        color="black"
      />
      <Heading size="sm" mb={4} color="primary" fontFamily="Joystix">
        {content[language].title}
      </Heading>
      <Text mt={2} color="text">
        <strong>{content[language].question}</strong>
        <br />
        {content[language].answer.map((line, index) => (
          <Box key={index} dangerouslySetInnerHTML={{ __html: line }} />
        ))}
      </Text>
    </Box>
  );
};

export default PIXFAQ;
