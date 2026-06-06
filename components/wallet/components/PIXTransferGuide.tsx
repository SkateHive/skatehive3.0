import { Box, Heading, OrderedList, ListItem, Text } from '@chakra-ui/react';
import type { PixDashboardData } from './PIXTabContent';

interface PixTransferGuideProps {
  pixDashboardData: PixDashboardData;
  language: 'en' | 'pt';
}

const PixTransferGuide = ({ pixDashboardData, language }: PixTransferGuideProps) => {
  const content = {
    en: {
      title: '💲 PIX to HBD',
      steps: [
        {
          text: 'Send a PIX transfer to this Key: ',
          strong: pixDashboardData.pixbeePixKey,
        },
        'In the PIX MESSAGE, specify the HIVE account to be credited with HBD. Example: "skater"',
        'To buy HIVE, specify hive after your account. Example: "skater420 hive"',
        {
          text: 'Check ',
          italic: 'Skatebank Balance',
          textAfter: ' above. If greater than our balance, your PIX will be refunded.',
        },
        'Send the PIX transfer and wait for the transfer.',
      ],
    },
    pt: {
      title: '💲 PIX para HBD',
      steps: [
        {
          text: 'Envie uma transferência para esta Chave PIX: ',
          strong: pixDashboardData.pixbeePixKey,
        },
        'Na MENSAGEM PIX, especifique a conta HIVE a ser creditada com HBD. Exemplo: "skater"',
        'Se quiser comprar HIVE, especifique hive após sua conta. Exemplo: "skater420 hive"',
        {
          text: 'Verifique o ',
          italic: 'Saldo Skatebank',
          textAfter: ' acima. Se for superior ao saldo, seu PIX será reembolsado.',
        },
        'Envie a transferência PIX e aguarde a transferência.',
      ],
    },
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
      <Heading size="sm" mb={4} color="primary" fontFamily="Joystix">
        {content[language].title}
      </Heading>
      <OrderedList pl={4} color="text">
        {content[language].steps.map((step, index) => (
          <ListItem key={index} mb={1}>
            {typeof step === 'string' ? (
              <Text>{step}</Text>
            ) : (
              <Text>
                {step.text}
                {step.strong && <Text as="strong">{step.strong}</Text>}
                {step.italic && <Text as="i">{step.italic}</Text>}
                {step.textAfter && step.textAfter}
              </Text>
            )}
          </ListItem>
        ))}
      </OrderedList>
    </Box>
  );
};

export default PixTransferGuide;
