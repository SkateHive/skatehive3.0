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
import { HIVEPREDICT_BRAND_COLOR } from "@/lib/predictions/constants";

interface PredictionsFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Q&A adapted from hivepredict.app/faq for the Skatehive context
// (HIVE/HBD only, skate category, 100+ HP to create).
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What are prediction markets?",
    a: (
      <>
        Parimutuel prediction markets on the Hive blockchain, powered by
        HivePredict. You stake on an outcome; when the market resolves, winners
        split the losing side&apos;s pool proportionally to their stakes. There
        are no bookmakers and no fixed odds.
      </>
    ),
  },
  {
    q: "How are the odds / percentages set?",
    a: "The pool sets them. Each outcome's share of the total pool is its implied probability — if 75% of the staked HIVE is on YES, YES shows 75%. Your payout depends on the pool composition at resolution, not when you bet.",
  },
  {
    q: "Do I need an account?",
    a: "To place a bet or create a market you need a Hive account connected with an active key (Hive Keychain or HiveAuth). Everything is signed by you and broadcast to the Hive blockchain.",
  },
  {
    q: "Which tokens can I use?",
    a: "Skatehive markets use HIVE and HBD. Hive Engine tokens are not supported here — we keep it simple.",
  },
  {
    q: "How do payouts and fees work?",
    a: "If your side wins you get your stake back, then split the losing pool proportionally. A 3% platform fee is taken from the losing pool only — your principal is never touched when you win.",
  },
  {
    q: "Can I lose more than I stake?",
    a: "No. The most you can lose is the amount you stake. There is no leverage, margin, or negative balance.",
  },
  {
    q: "Who resolves markets?",
    a: "Price and sports markets can resolve automatically from a data feed. Skate and other markets are resolved manually by admins using the official result. If a market can't be resolved (event cancelled, no official result), it's voided and all stakes are refunded.",
  },
  {
    q: "Who can create a market?",
    a: "Any Hive account with more than 100 HP can create a market from Skatehive: pick the question shape (Yes/No or multiple options), outcomes, token, dates, and place an opening bet. All markets are created in the Skateboarding category.",
  },
  {
    q: "Is it fair? Can results be faked?",
    a: "The Hive blockchain is the source of truth. Every market, bet, resolution, and payout is a public, verifiable on-chain transaction — HivePredict just indexes them.",
  },
];

export default function PredictionsFaqModal({ isOpen, onClose }: PredictionsFaqModalProps) {
  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="how-it-works"
      size={{ base: "full", md: "xl" }}
    >
      <Box p={4} color="text">
        <Accordion allowToggle defaultIndex={[0]}>
          {FAQS.map((item, i) => (
            <AccordionItem key={i} borderColor="border">
              <AccordionButton _hover={{ bg: "panelHover" }} px={2}>
                <Box flex="1" textAlign="left" fontWeight={600}>
                  {item.q}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4} px={2} color="dim" fontSize="sm">
                {item.a}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        <Text mt={4} fontSize="xs" color="dim">
          Full platform terms live at{" "}
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
