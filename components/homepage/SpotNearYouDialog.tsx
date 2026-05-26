"use client"

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Box,
  Text,
  Button,
  Flex,
  Spinner,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useTranslations } from "@/contexts/LocaleContext"
import { useSpotNearYou, getSpotImage, getSpotTitle } from "@/hooks/useSpotNearYou"

const STORAGE_KEY = "skatehive_spot_dialog_seen"

export default function SpotNearYouDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const { displaySpot, isLoading } = useSpotNearYou()
  const router = useRouter()
  const t = useTranslations("spotWidget")

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth >= 768) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const elapsed = Date.now() - parseInt(stored, 10)
      if (elapsed < 24 * 60 * 60 * 1000) return
    }
    setIsOpen(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setIsOpen(false)
  }

  function goToMap() {
    dismiss()
    router.push("/map")
  }

  if (!isOpen) return null

  const image = displaySpot ? getSpotImage(displaySpot) : ""
  const title = displaySpot ? getSpotTitle(displaySpot, t("noName")) : ""

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismiss}
      isCentered
      motionPreset="slideInBottom"
      blockScrollOnMount={false}
    >
      <ModalOverlay bg="blackAlpha.800" />
      <ModalContent
        bg="rgba(10,10,10,0.97)"
        borderRadius="0"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        mx={4}
      >
        <ModalBody p={0}>
          {isLoading ? (
            <Flex justify="center" align="center" height="200px">
              <Spinner size="md" color="primary" />
            </Flex>
          ) : (
            <Box position="relative" width="100%" height="200px">
              {image && (
                <Image
                  src={image}
                  alt={title}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="100vw"
                />
              )}
            </Box>
          )}
          <Box p={4}>
            <Text fontSize="sm" fontWeight="600" color="primary" mb={2}>
              {t("dialogTitle")}
            </Text>
            {!isLoading && (
              <Text fontSize="md" fontWeight="600" color="white" mb={4} noOfLines={2}>
                {title}
              </Text>
            )}
            <Flex gap={3}>
              <Button
                flex={1}
                size="sm"
                colorScheme="green"
                borderRadius="0"
                onClick={goToMap}
              >
                {t("viewOnMap")}
              </Button>
              <Button
                flex={1}
                size="sm"
                variant="outline"
                borderRadius="0"
                color="whiteAlpha.700"
                borderColor="whiteAlpha.300"
                onClick={dismiss}
              >
                {t("dismiss")}
              </Button>
            </Flex>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
