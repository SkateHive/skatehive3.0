import { useState } from 'react';
import { Box, Heading, OrderedList, ListItem, IconButton } from '@chakra-ui/react';
import { FaGlobe } from 'react-icons/fa';
import { PixDashboardData } from './PIXTabContent';

interface PixTransferGuideProps {
  pixDashboardData: PixDashboardData;
}

const PixTransferGuide = ({ pixDashboardData }: PixTransferGuideProps) => {
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');

  const content = {
    en: {
      title: '💲 PIX to HBD Transfer',
      steps: [
        `Send a PIX transfer to this Key: <strong>${pixDashboardData.pixbeePixKey}</strong>`,
        'In the PIX MESSAGE, specify the HIVE account to be credited to. Example: "skater"',
        'In the PIX MESSAGE, specify the hive after your account to be credited with hive. Example: "skater420 hive"',
        'For HBD and HIVE, check the <i>Skatebank Balance</i> above. If less than minimum deposit or greater than balance, your PIX will be refunded.',
        'Send the PIX transfer and wait for the HBD to be received.',
      ],
    },
    pt: {
      title: '💲 Transferência PIX para HBD',
      steps: [
        `Envie uma transferência PIX para esta Chave: <strong>${pixDashboardData.pixbeePixKey}</strong>`,
        'Na MENSAGEM PIX, especifique a conta HIVE a ser creditada. Exemplo: "skater"',
        'Na MENSAGEM PIX, especifique o hive após sua conta para ser creditado com hive. Exemplo: "skater420 hive"',
        'Para HBD e HIVE, verifique o <i>Saldo Skatebank</i> acima. Se for inferior ao depósito mínimo ou superior ao saldo, seu PIX será reembolsado.',
        'Envie a transferência PIX e aguarde o recebimento do HBD.',
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
      <OrderedList pl={4} color="text">
        {content[language].steps.map((step, index) => (
          <ListItem key={index} mb={1} dangerouslySetInnerHTML={{ __html: step }} />
        ))}
      </OrderedList>
    </Box>
  );
};

export default PixTransferGuide;
