import {
  Text,
  Box,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations, useLocale } from "@/contexts/LocaleContext";
import { useMemo } from "react";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Skaters currently scoring above zero, and how many skaters there are. */
  scoredCount?: number;
  totalCount?: number;
}

/** Every penalty the score applies, worst case first. */
const PENALTIES: { labelKey: string; amount: number }[] = [
  { labelKey: "penaltyNoHp", amount: -5000 },
  { labelKey: "penaltyNoWitness", amount: -3500 },
  { labelKey: "penaltyNoEth", amount: -2000 },
  { labelKey: "penaltyNoPosts", amount: -2000 },
  { labelKey: "penaltyNoHive", amount: -1000 },
  { labelKey: "penaltyNoNft", amount: -900 },
  { labelKey: "penaltyNoGnars", amount: -300 },
  { labelKey: "penaltyNoHbd", amount: -200 },
  { labelKey: "penaltyInactive", amount: -100 },
];

export default function RulesModal({
  isOpen,
  onClose,
  scoredCount,
  totalCount,
}: RulesModalProps) {
  const t = useTranslations();
  const { locale } = useLocale();
  // "-5,000" reads as minus five where the comma is a decimal separator.
  const formatAmount = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('leaderboard.rulesModalTitle')}
      windowId="leaderboard-rules"
      size="3xl"
    >
      <Box overflowY="auto" maxH="70vh" px={2}>
          <Box>
            <Text fontWeight="bold" mb={2} color="text">
              {t('leaderboard.whatIsLeaderboard')}
            </Text>
            <Text fontSize="sm" color="dim" mb={4}>
              {t('leaderboard.leaderboardDescription')}
            </Text>

            {/* The question most skaters actually arrive with */}
            <Box
              bg="panel"
              borderLeft="4px solid"
              borderColor="primary"
              borderRadius="md"
              p={3}
              mb={4}
            >
              <Text fontWeight="bold" mb={2} color="text">
                {t('leaderboard.whyZeroTitle')}
              </Text>
              <Text fontSize="sm" color="dim" mb={2}>
                {t('leaderboard.whyZeroBody')}
              </Text>
              {scoredCount != null && totalCount != null && (
                <Text fontSize="sm" color="text" fontWeight="bold" mb={3}>
                  {t('leaderboard.whyZeroStat')
                    .replace('{count}', String(scoredCount))
                    .replace('{total}', String(totalCount))}
                </Text>
              )}

              <Text fontWeight="bold" fontSize="sm" mb={1} color="text">
                {t('leaderboard.whyZeroPenaltyTitle')}
              </Text>
              <Box as="table" width="100%" fontSize="sm" mb={3}
                style={{ borderCollapse: "collapse" }}>
                <tbody>
                  {PENALTIES.map(({ labelKey, amount }) => (
                    <tr key={labelKey}>
                      <td style={{ padding: 4 }}>
                        {t(`leaderboard.${labelKey}`)}
                      </td>
                      <td
                        align="right"
                        style={{
                          padding: 4,
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          color: "var(--chakra-colors-error)",
                        }}
                      >
                        {formatAmount.format(amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Box>

              <Text fontWeight="bold" fontSize="sm" mb={1} color="text">
                {t('leaderboard.whyZeroFixTitle')}
              </Text>
              <ul style={{ marginLeft: 18, fontSize: "0.875rem",
                color: "var(--chakra-colors-dim)" }}>
                <li>{t('leaderboard.whyZeroFix1')}</li>
                <li>{t('leaderboard.whyZeroFix2')}</li>
                <li>{t('leaderboard.whyZeroFix3')}</li>
              </ul>
            </Box>
            <Text fontWeight="bold" mb={2} color="text">
              {t('leaderboard.howYouEarnPoints')}
            </Text>
            <Text fontSize="sm" color="dim" mb={3}>
              {t('leaderboard.pointsCalculationDescription')}
            </Text>
            <Box
              as="table"
              width="100%"
              mb={4}
              fontSize="sm"
              color="text"
              borderRadius="md"
              overflow="hidden"
              style={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--chakra-colors-primary)",
                  }}
                >
                  <th
                    align="left"
                    style={{
                      padding: 8,
                      color: "var(--chakra-colors-background)",
                      fontWeight: "bold",
                    }}
                  >
                    {t('leaderboard.category')}
                  </th>
                  <th
                    align="left"
                    style={{
                      padding: 8,
                      color: "var(--chakra-colors-background)",
                      fontWeight: "bold",
                    }}
                  >
                    {t('leaderboard.pointsCalculation')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.hivepower')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.hivepowerCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.postsSnapsScore')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.postsSnapsCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.skatehiveNfts')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.skatehiveNftsCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.gnarsVotes')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.gnarsVotesCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.hbdSavings')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.hbdSavingsCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.hiveBalance')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.hiveBalanceCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.givethDonations')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.givethDonationsCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.witnessVote')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.witnessVoteCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.votingMana')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.votingManaCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.lastPostActivity')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.lastPostActivityCalc')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 6 }}>{t('leaderboard.ethWalletBonus')}</td>
                  <td style={{ padding: 6 }}>
                    {t('leaderboard.ethWalletBonusCalc')}
                  </td>
                </tr>
              </tbody>
            </Box>

            <Text fontWeight="bold" mb={2} color="text">
              {t('leaderboard.postsSnapsScoreDetails')}
            </Text>
            <Box
              bg="panel"
              color="text"
              borderRadius="md"
              p={3}
              fontSize="sm"
              mb={4}
            >
              <Text mb={2}>
                {t('leaderboard.postsScoreDetail')}
              </Text>
              <Text mb={2}>
                {t('leaderboard.snapsScoreDetail')}
              </Text>
              <Text mb={2}>
                <strong>{t('leaderboard.formula')}</strong>
              </Text>
              <Box
                bg="primary"
                color="background"
                borderRadius="md"
                p={2}
                fontSize="xs"
                fontFamily="mono"
                textAlign="center"
              >
                {t('leaderboard.postsSnapsFormula')}
              </Box>
              <Text mt={2} fontSize="xs">
                <strong>{t('leaderboard.zeroScorePenalty')}</strong>
              </Text>
            </Box>

            <Text fontWeight="bold" mb={2} color="text">
              {t('leaderboard.totalPointsFormula')}
            </Text>
            <Box
              bg="primary"
              color="background"
              borderRadius="md"
              p={3}
              fontSize="sm"
              fontFamily="mono"
              mb={4}
              textAlign="center"
            >
              <Text color="inherit">
                <b>{t('leaderboard.totalPointsFormulaText')}</b>
              </Text>
            </Box>

            <Text fontSize="xs" color="dim" mb={4} textAlign="center">
              <strong>{t('leaderboard.totalPointsNote')}</strong>
            </Text>

            <Text fontWeight="bold" mb={2} color="text">
              {t('leaderboard.quickRules')}
            </Text>
            <ul
              style={{
                marginLeft: 18,
                marginBottom: 16,
                color: "var(--chakra-colors-text)",
                fontSize: "0.95em",
              }}
            >
              <li>{t('leaderboard.quickRule1')}</li>
              <li>{t('leaderboard.quickRule2')}</li>
              <li>{t('leaderboard.quickRule3')}</li>
              <li>
                <strong>{t('leaderboard.quickRule4')}</strong>
              </li>
              <li>
                <strong>{t('leaderboard.quickRule5')}</strong>
              </li>
            </ul>
          </Box>
      </Box>
    </SkateModal>
  );
}
