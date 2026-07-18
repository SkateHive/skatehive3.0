"use client";
import React from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Link,
  Text,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations } from "@/lib/i18n/hooks";
import { HIVEPREDICT_BRAND_COLOR } from "@/lib/predictions/constants";

interface PredictionsFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAQ_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function PredictionsFaqModal({ isOpen, onClose }: PredictionsFaqModalProps) {
  const t = useTranslations("predictions");

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="how-it-works"
      size={{ base: "full", md: "xl" }}
    >
      <Box p={4} color="text">
        <Accordion allowToggle defaultIndex={[0]}>
          {FAQ_INDEXES.map((i) => (
            <AccordionItem key={i} borderColor="border">
              <AccordionButton _hover={{ bg: "panelHover" }} px={2}>
                <Box flex="1" textAlign="left" fontWeight={600}>
                  {t(`faqQ${i}`)}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4} px={2} color="dim" fontSize="sm">
                {t(`faqA${i}`)}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        <Text mt={4} fontSize="xs" color="dim">
          {t("faqTermsPrefix")}{" "}
          <Link
            href="https://hivepredict.app/faq"
            isExternal
            sx={{
              color: `${HIVEPREDICT_BRAND_COLOR} !important`,
              "&:hover": { textDecoration: "none !important", opacity: 0.85 },
            }}
          >
            hivepredict.app/faq
          </Link>
          .
        </Text>
      </Box>
    </SkateModal>
  );
}
