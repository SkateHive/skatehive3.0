"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Box,
  Container,
  Button,
  Center,
  HStack,
  Text,
  IconButton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { EnsName as Name, EnsAvatar as Avatar } from "@/components/shared/EnsIdentity";
import { CustomConnectButton } from "../../shared/CustomConnectButton";
import { useRouter } from "next/navigation";

export default function AuctionMobileNavbar() {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const router = useRouter();

  // Only render on mobile
  if (!isMobile) return null;

  // Removed entire navbar to eliminate blank space
  return null;
}
