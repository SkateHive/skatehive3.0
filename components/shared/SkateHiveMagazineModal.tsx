import {
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Icon,
} from "@chakra-ui/react";
import { FaBookOpen, FaTrophy, FaCoins } from "react-icons/fa";
import { useState, useMemo } from "react";
import MagazineModal from "./MagazineModal";
import { HIVE_CONFIG } from "@/config/app.config";
import SkateModal from "./SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";

interface SkateHiveMagazineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SkateHiveMagazineModal({
  isOpen,
  onClose,
}: SkateHiveMagazineModalProps) {
  const t = useTranslations();
  const [isMagazineOpen, setIsMagazineOpen] = useState(false);

  const handleOpenMagazine = () => {
    setIsMagazineOpen(true);
    onClose();
  };

  const handleCloseMagazine = () => {
    setIsMagazineOpen(false);
  };

  const magazineTag = useMemo(() => [{ tag: HIVE_CONFIG.COMMUNITY_TAG, limit: 20 }], []);
  const magazineQuery = "trending";

  return (
    <>
      <SkateModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('magazine.title')}
        size="lg"
        footer={
          <Button
            colorScheme="green"
            size="lg"
            onClick={handleOpenMagazine}
            leftIcon={<Icon as={FaBookOpen} />}
            w="full"
          >
            {t('magazine.viewInfinityMag')}
          </Button>
        }
      >
        <Box p={6}>
          <VStack spacing={6} align="stretch">
            <Text
              fontSize="md"
              color="text"
              textAlign="center"
              lineHeight="tall"
            >
              {t('magazine.description')}
            </Text>

            <VStack spacing={4} align="stretch">
              <HStack spacing={4} align="center">
                <Icon as={FaBookOpen} color="blue.500" boxSize={6} />
                <Box flex={1}>
                  <Text fontWeight="bold" color="primary">
                    {t('magazine.madeBySkaters')}
                  </Text>
                  <Text fontSize="sm" color="dim">
                    {t('magazine.madeByDescription')}
                  </Text>
                </Box>
              </HStack>

              <HStack spacing={4} align="center">
                <Icon as={FaTrophy} color="orange.500" boxSize={6} />
                <Box flex={1}>
                  <Text fontWeight="bold" color="primary">
                    {t('magazine.curatedBySkaters')}
                  </Text>
                  <Text fontSize="sm" color="dim">
                    {t('magazine.curatedByDescription')}
                  </Text>
                </Box>
              </HStack>

              <HStack spacing={4} align="center">
                <Icon as={FaCoins} color="yellow.500" boxSize={6} />
                <Box flex={1}>
                  <Text fontWeight="bold" color="primary">
                    {t('magazine.monetizedByPage')}
                  </Text>
                  <Text fontSize="sm" color="dim">
                    {t('magazine.monetizedByDescription')}
                  </Text>
                </Box>
              </HStack>
            </VStack>
          </VStack>
        </Box>
      </SkateModal>

      {/* Magazine Modal */}
      <MagazineModal
        isOpen={isMagazineOpen}
        onClose={handleCloseMagazine}
        magazineTag={magazineTag}
        magazineQuery={magazineQuery}
      />
    </>
  );
}
