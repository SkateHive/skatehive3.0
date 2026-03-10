"use client";

import React from "react";
import HubNavigation from "@/components/shared/HubNavigation";
import { Box } from "@chakra-ui/react";

interface TricksPageWrapperProps {
  children: React.ReactNode;
}

export default function TricksPageWrapper({ children }: TricksPageWrapperProps) {
  return (
    <>
      <Box px={{ base: 2, md: 4 }} pt={4}>
        <HubNavigation />
      </Box>
      {children}
    </>
  );
}
