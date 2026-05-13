"use client"

import { Box, Text, Flex, Spinner, Button } from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import { useSkatespots } from "@/hooks/useSkatespots"
import { Discussion } from "@hiveio/dhive"
import { useMemo } from "react"
import { useTranslations } from "@/contexts/LocaleContext"

function getSpotImage(spot: Discussion): string {
  try {
    const match = spot.body?.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    if (match?.[1]) return match[1]
  } catch {}
  return ""
}

function getSpotTitle(spot: Discussion): string {
  try {
    const match = spot.body?.match(/Spot Name:\s*(.+)/i)
    if (match?.[1]) return match[1].trim()
  } catch {}
  return spot.title || "Pico sem nome"
}

export default function SpotNearYou() {
  const { spots, isLoading } = useSkatespots()
  const router = useRouter()
  const t = useTranslations("spotWidget")

  const randomSpot = useMemo(() => {
    if (!spots.length) return null
    const index = Math.floor(Math.random() * spots.length)
    return spots[index]
  }, [spots])

  const image = randomSpot ? getSpotImage(randomSpot) : ""
  const title = randomSpot ? getSpotTitle(randomSpot) : ""

  return (
    <Box
      mt={3}
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="0"
      p={3}
      bg="rgba(20,20,20,0.45)"
    >
      <Flex align="center" justify="space-between" mb={3}>
        <Text fontSize="sm" fontWeight="500" color="primary">
          {t("title")}
        </Text>
        {randomSpot && (
          <Button
            size="xs"
            variant="outline"
            borderRadius="0"
            fontSize="11px"
            onClick={() => router.push(`/post/${randomSpot.author}/${randomSpot.permlink}`)}
          >
            {t("viewMore")}
          </Button>
        )}
      </Flex>

      {isLoading ? (
        <Flex justify="center" py={4}>
          <Spinner size="sm" color="primary" />
        </Flex>
      ) : randomSpot ? (
        <>
          {image && (
            <img
              src={image}
              alt={title}
              style={{
                width: "100%",
                height: "160px",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
          <Text
            fontSize="sm"
            fontWeight="500"
            color="white"
            mt={2}
            mb={2}
            noOfLines={1}
          >
            {title}
          </Text>
        </>
      ) : null}

      <Button
        width="100%"
        size="sm"
        variant="outline"
        borderRadius="0"
        fontSize="13px"
        mt={2}
        onClick={() => router.push("/map")}
      >
        {t("viewAllSpots")}
      </Button>
    </Box>
  )
}
