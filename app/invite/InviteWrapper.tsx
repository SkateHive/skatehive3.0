"use client";

import dynamic from "next/dynamic";
import { Flex, Spinner } from "@chakra-ui/react";

const InvitePageClient = dynamic(() => import("./InvitePageClient"), {
  ssr: false,
  loading: () => (
    <Flex minH="60vh" align="center" justify="center">
      <Spinner size="lg" color="primary" />
    </Flex>
  ),
});

export default function InviteWrapper() {
  return <InvitePageClient />;
}
