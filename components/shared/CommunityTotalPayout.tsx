"use client";

import {
  Box,
  Center,
  Flex,
  Image,
  Text,
  VStack,
  useTheme,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatEther } from "viem";
import SkateHiveMagazineModal from "./SkateHiveMagazineModal";
import { HIVE_CONFIG } from "@/config/app.config";
import { useTranslations } from "@/contexts/LocaleContext";

const SKATEHIVE_TAG = HIVE_CONFIG.COMMUNITY_TAG;
const BLINK_INTERVAL = 5000; // alternate every 5 seconds

function CommunityTotalPayout() {
  const t = useTranslations();
  const router = useRouter();
  const [totalHBDPayout, setTotalHBDPayout] = useState<number>(0);
  const [displayedNumber, setDisplayedNumber] = useState<string>("00000");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Bounty totals
  const [totalBountyUsd, setTotalBountyUsd] = useState<number>(0);
  const [hasBounties, setHasBounties] = useState(false);
  const [showingBounties, setShowingBounties] = useState(false);

  // Modal state
  const { isOpen, onOpen, onClose } = useDisclosure();

  const theme = useTheme();
  const accentColor = theme.colors.accent || "#B0C4DE";
  const textColor = theme.colors.text || "#1E90FF";
  const borderRadius = theme.radii.lg || "16px";
  const bodyFont = theme.fonts.body;
  const fontWeightBold = theme.fontWeights.bold || 700;
  const fontSizeSm = theme.fontSizes.sm || "14px";
  const fontSizeXl = theme.fontSizes.xl || "20px";
  const fontSizeBelow = theme.fontSizes["md"] || "16px";

  const formattedNumber = useMemo(
    () =>
      totalHBDPayout
        .toLocaleString("en-US", {
          style: "decimal",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
        .replace(/,/g, ""),
    [totalHBDPayout]
  );

  const formattedBountyNumber = useMemo(
    () =>
      Math.round(totalBountyUsd)
        .toLocaleString("en-US", {
          style: "decimal",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
        .replace(/,/g, ""),
    [totalBountyUsd]
  );

  // Fetch community payout
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `https://stats.hivehub.dev/communities?c=${SKATEHIVE_TAG}`
        );
        const data = await response.json();
        const payout = parseFloat(
          data[SKATEHIVE_TAG]?.total_payouts_hbd?.replace("$", "") || "90000"
        );
        setTotalHBDPayout(payout);
      } catch (error: any) {
        console.error("Error fetching data: ", error);
        setError(error.message);
        setTotalHBDPayout(420.0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch open bounties total
  useEffect(() => {
    const fetchBounties = async () => {
      try {
        // Fetch open bounties and ETH price in parallel
        const [bountiesRes, priceRes] = await Promise.all([
          fetch("/api/poidh/bounties?status=open&limit=100&filterSkate=true"),
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
          ),
        ]);

        if (!bountiesRes.ok) return;

        const bountiesData = await bountiesRes.json();
        const bounties = bountiesData.bounties || [];

        let ethPrice = 2500;
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          ethPrice = priceData?.ethereum?.usd ?? 2500;
        }

        if (bounties.length > 0) {
          // Sum all bounty amounts in USD
          let totalUsd = 0;
          for (const b of bounties) {
            try {
              const ethAmount = parseFloat(formatEther(BigInt(b.amount)));
              totalUsd += ethAmount * ethPrice;
            } catch {
              // skip invalid amounts
            }
          }

          if (totalUsd > 0) {
            setTotalBountyUsd(totalUsd);
            setHasBounties(true);
          }
        }
      } catch (e) {
        console.error("Error fetching bounty totals:", e);
      }
    };

    fetchBounties();
  }, []);

  // Scramble animation for initial load
  useEffect(() => {
    if (!loading && !error) {
      const target = showingBounties ? formattedBountyNumber : formattedNumber;
      const intervalId = setInterval(() => {
        setDisplayedNumber(
          target
            .split("")
            .map(() => Math.floor(Math.random() * 10))
            .join("")
        );
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        setDisplayedNumber(target);
      }, 4000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [formattedNumber, loading, error]);

  // Blink between community payout and bounty total
  useEffect(() => {
    if (!hasBounties || loading || error) return;

    const interval = setInterval(() => {
      setShowingBounties((prev) => {
        const next = !prev;
        // Quick scramble transition
        const target = next ? formattedBountyNumber : formattedNumber;
        let scrambleCount = 0;
        const scramble = setInterval(() => {
          setDisplayedNumber(
            target
              .split("")
              .map(() => Math.floor(Math.random() * 10))
              .join("")
          );
          scrambleCount++;
          if (scrambleCount >= 8) {
            clearInterval(scramble);
            setDisplayedNumber(target);
          }
        }, 80);
        return next;
      });
    }, BLINK_INTERVAL);

    return () => clearInterval(interval);
  }, [hasBounties, loading, error, formattedNumber, formattedBountyNumber]);

  const handleClick = useCallback(() => {
    if (showingBounties && hasBounties) {
      router.push("/bounties");
    } else {
      onOpen();
    }
  }, [showingBounties, hasBounties, router, onOpen]);

  const label = showingBounties
    ? "Open Bounties"
    : t("common.magazineTotalRewards");

  return (
    <center>
      <Box
        position="relative"
        overflow="hidden"
        zIndex={0}
        mb={4}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        cursor={"pointer"}
        onClick={handleClick}
      >
        {isHovered && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundImage={`url('/images/moneyfalling.gif')`}
            backgroundRepeat="no-repeat"
            backgroundPosition="center"
            backgroundSize="cover"
            borderRadius={borderRadius}
            pointerEvents="none"
            zIndex={2}
            opacity={1}
          />
        )}
        {loading ? (
          <VStack zIndex={2} fontFamily={bodyFont}>
            <Image
              alt="Loading..."
              boxSize={"24px"}
              src="/images/spinning-joint-sm.gif"
              zIndex={2}
            />
            <Text
              fontSize={fontSizeSm}
              color={accentColor}
              zIndex={2}
              fontFamily={bodyFont}
            >
              {t("common.loading")}
            </Text>
          </VStack>
        ) : error ? (
          <Text
            fontSize={fontSizeXl}
            color={textColor}
            fontFamily={bodyFont}
          >{`${t("common.error")}: ${error}`}</Text>
        ) : (
          <Flex
            justifyContent="center"
            flexDirection="column"
            alignItems="center"
            zIndex={2}
            fontFamily={bodyFont}
          >
            <Text
              color={"primary"}
              fontSize={"24px"}
              fontWeight={fontWeightBold}
              gap={1}
              display={"flex"}
              zIndex={2}
              style={{
                fontFamily: `'Joystix', 'VT323', 'Fira Mono', 'monospace'`,
              }}
            >
              ${displayedNumber} USD
            </Text>
            <Center>
              <Text
                color={accentColor}
                fontSize={fontSizeBelow}
                fontWeight={fontWeightBold}
                fontFamily={bodyFont}
              >
                {label}
              </Text>
            </Center>
          </Flex>
        )}
      </Box>

      {/* SkateHive Magazine Modal */}
      <SkateHiveMagazineModal isOpen={isOpen} onClose={onClose} />
    </center>
  );
}

export default CommunityTotalPayout;
