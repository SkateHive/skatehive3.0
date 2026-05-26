"use client"

import { Box, Text, Flex, Spinner, Button } from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Discussion } from "@hiveio/dhive"
import { useMemo, useState, useEffect } from "react"
import { useTranslations } from "@/contexts/LocaleContext"

function getSpotImage(spot: Discussion): string {
  try {
    const match = spot.body?.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    if (match?.[1]) return match[1]
  } catch {}
  return ""
}

function getSpotTitle(spot: Discussion, fallback: string): string {
  try {
    const match = spot.body?.match(/Spot Name:\s*(.+)/i)
    if (match?.[1]) return match[1].trim()
  } catch {}
  return spot.title || fallback
}

function isValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function parseSpotCoords(spot: Discussion): { lat: number; lng: number } | null {
  const body = spot.body || ""

  // 1. 🌐 lat, lng
  try {
    const match = body.match(/🌐\s*([-\d.]+),\s*([-\d.]+)/)
    if (match?.[1] && match?.[2]) {
      const lat = parseFloat(match[1]), lng = parseFloat(match[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 2. Location: lat, lng (used by Brazilian spots)
  try {
    const locMatch = body.match(/Location:\s*([-\d.]+),\s*([-\d.]+)/i)
    if (locMatch?.[1] && locMatch?.[2]) {
      const lat = parseFloat(locMatch[1]), lng = parseFloat(locMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 4. Google Maps data param: !3d<lat>!4d<lng> (most reliable in share URLs)
  try {
    const dataMatch = body.match(/[!?&]3d([-\d.]+)[!&]4d([-\d.]+)/)
    if (dataMatch?.[1] && dataMatch?.[2]) {
      const lat = parseFloat(dataMatch[1]), lng = parseFloat(dataMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 5. Google Maps URL with @lat,lng (e.g. /maps/place/.../@lat,lng,zoom or /maps/@lat,lng)
  try {
    const atMatch = body.match(/google\.com\/maps[^\s]*@([-\d.]+),([-\d.]+)/)
    if (atMatch?.[1] && atMatch?.[2]) {
      const lat = parseFloat(atMatch[1]), lng = parseFloat(atMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 6. Google Maps URL with ?q=lat,lng or &q=lat,lng (numeric query)
  try {
    const qMatch = body.match(/google\.com\/maps[^\s]*[?&]q=([-\d.]+),([-\d.]+)/)
    if (qMatch?.[1] && qMatch?.[2]) {
      const lat = parseFloat(qMatch[1]), lng = parseFloat(qMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 7. Google Maps URL with ?ll=lat,lng
  try {
    const llMatch = body.match(/google\.com\/maps[^\s]*[?&]ll=([-\d.]+),([-\d.]+)/)
    if (llMatch?.[1] && llMatch?.[2]) {
      const lat = parseFloat(llMatch[1]), lng = parseFloat(llMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  // 8. json_metadata: {location: {lat, lng}} or GeoJSON coordinates
  try {
    const meta = JSON.parse((spot as any).json_metadata || "{}")
    const loc = meta?.location
    if (loc) {
      const lat = parseFloat(loc.lat ?? loc.latitude)
      const lng = parseFloat(loc.lng ?? loc.longitude)
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
    const coords = meta?.coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const lat = coords[1], lng = coords[0]
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {}

  return null
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function SpotNearYou() {
  const [spots, setSpots] = useState<Discussion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const t = useTranslations("spotWidget")
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    fetch("/api/skatespots?page=1&limit=500")
      .then((r) => r.json())
      .then((data) => { if (data.success) setSpots(data.data) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserCoords(null),
      { timeout: 5000, maximumAge: 60000 }
    )
  }, [])

  const randomSpot = useMemo(() => {
    if (!spots.length) return null
    const index = Math.floor(Math.random() * spots.length)
    return spots[index]
  }, [spots])

  const nearestSpot = useMemo(() => {
    if (!userCoords || !spots.length) return null
    let closest: Discussion | null = null
    let minDist = Infinity
    for (const spot of spots) {
      const coords = parseSpotCoords(spot)
      if (!coords) continue
      const dist = haversineDistance(userCoords.lat, userCoords.lng, coords.lat, coords.lng)
      if (dist < minDist) {
        minDist = dist
        closest = spot
      }
    }
    return minDist <= 50 ? closest : null
  }, [spots, userCoords])

  const displaySpot = nearestSpot ?? randomSpot
  const image = displaySpot ? getSpotImage(displaySpot) : ""
  const title = displaySpot ? getSpotTitle(displaySpot, t("noName")) : ""
  const spotHref = displaySpot ? `/spot/${displaySpot.author}/${displaySpot.permlink}` : null

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
        {spotHref && (
          <Button
            size="xs"
            variant="outline"
            borderRadius="0"
            fontSize="11px"
            onClick={() => router.push(spotHref)}
          >
            {t("viewMore")}
          </Button>
        )}
      </Flex>

      {isLoading ? (
        <Flex justify="center" py={4}>
          <Spinner size="sm" color="primary" />
        </Flex>
      ) : displaySpot && spotHref ? (
        <Box
          as="a"
          href={spotHref}
          display="block"
          cursor="pointer"
          _hover={{ opacity: 0.9 }}
          transition="opacity 0.15s"
        >
          {image && (
            <Box position="relative" width="100%" height="160px">
              <Image
                src={image}
                alt={title}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 768px) 100vw, 300px"
              />
            </Box>
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
        </Box>
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
