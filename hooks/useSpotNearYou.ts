"use client"

import { useMemo, useState, useEffect } from "react"
import { Discussion } from "@hiveio/dhive"

const MAX_NEARBY_KM = 50

export function getSpotImage(spot: Discussion): string {
  try {
    const match = spot.body?.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    if (match?.[1]) return match[1]
  } catch {}
  return ""
}

export function getSpotTitle(spot: Discussion, fallback: string): string {
  try {
    const match = spot.body?.match(/Spot Name:\s*(.+)/i)
    if (match?.[1]) return match[1].trim()
  } catch {}
  return spot.title || fallback
}

function isValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function parseSpotCoords(spot: Discussion): { lat: number; lng: number } | null {
  const body = spot.body || ""
  const patterns: RegExp[] = [
    /🌐\s*([-\d.]+),\s*([-\d.]+)/,
    /Location:\s*([-\d.]+),\s*([-\d.]+)/i,
    /[!?&]3d([-\d.]+)[!&]4d([-\d.]+)/,
    /google\.com\/maps[^\s]*@([-\d.]+),([-\d.]+)/,
    /google\.com\/maps[^\s]*[?&]q=([-\d.]+),([-\d.]+)/,
    /google\.com\/maps[^\s]*[?&]ll=([-\d.]+),([-\d.]+)/,
  ]
  for (const re of patterns) {
    try {
      const m = body.match(re)
      if (m?.[1] && m?.[2]) {
        const lat = parseFloat(m[1]), lng = parseFloat(m[2])
        if (isValidCoord(lat, lng)) return { lat, lng }
      }
    } catch {}
  }
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

export interface SpotNearYouState {
  displaySpot: Discussion | null
  isNearby: boolean
  isLoading: boolean
}

export function useSpotNearYou(): SpotNearYouState {
  const [spots, setSpots] = useState<Discussion[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

  const [randomSpot, setRandomSpot] = useState<Discussion | null>(null)
  useEffect(() => {
    if (!spots.length) return
    setRandomSpot(spots[Math.floor(Math.random() * spots.length)])
  }, [spots])

  const nearestSpot = useMemo(() => {
    if (!userCoords || !spots.length) return null
    let closest: Discussion | null = null
    let minDist = Infinity
    for (const spot of spots) {
      const coords = parseSpotCoords(spot)
      if (!coords) continue
      const dist = haversineDistance(userCoords.lat, userCoords.lng, coords.lat, coords.lng)
      if (dist < minDist) { minDist = dist; closest = spot }
    }
    return minDist <= MAX_NEARBY_KM ? closest : null
  }, [spots, userCoords])

  const displaySpot = nearestSpot ?? randomSpot
  const isNearby = nearestSpot !== null

  return { displaySpot, isNearby, isLoading }
}
