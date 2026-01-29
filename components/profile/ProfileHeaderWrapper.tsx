"use client";
import React, { ReactNode } from "react";
import { Box, Grid, GridItem, Image } from "@chakra-ui/react";

interface ProfileHeaderWrapperProps {
  coverImage: string;
  username: string;
  identity: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode; // Optional stats row (e.g., token values, follower counts)
}

/**
 * Unified profile header wrapper with 2-column grid layout
 *
 * Layout:
 * - Desktop: 2-column grid (identity left, actions right)
 * - Mobile: stacked vertically (identity, actions, stats)
 *
 * Spacing: Uses consistent 8/12/16/24/32px scale
 * Grid alignment: Left content aligns left, right content aligns right
 */
export default function ProfileHeaderWrapper({
  coverImage,
  username,
  identity,
  actions,
  stats,
}: ProfileHeaderWrapperProps) {
  return (
    <Box
      position="relative"
      w="100%"
      maxW="container.xl"
      mx="auto"
      overflow="hidden"
      borderRadius="none"
    >
      {/* Cover Image Background with fixed aspect ratio */}
      <Box
        position="relative"
        w="100%"
        paddingTop={{ base: "50%", md: "31.25%" }} // 2:1 mobile, 16:5 desktop
        overflow="hidden"
      >
        <Image
          src={coverImage}
          alt={`${username} cover`}
          position="absolute"
          top={0}
          left={0}
          w="100%"
          h="100%"
          objectFit="cover"
          fallback={
            <Box
              position="absolute"
              top={0}
              left={0}
              w="100%"
              h="100%"
              bg="linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)"
            />
          }
        />

        {/* Gradient overlay for text readability */}
        <Box
          position="absolute"
          top={0}
          left={0}
          w="100%"
          h="100%"
          bgGradient="linear(to-b, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)"
        />

        {/* Content overlay - 2-column grid layout */}
        <Box
          position="absolute"
          bottom={0}
          left={0}
          w="100%"
          px={{ base: 4, md: 8 }}
          py={{ base: 4, md: 6 }}
        >
          <Grid
            templateColumns={{ base: "1fr", md: "1fr auto" }}
            gap={{ base: 4, md: 6 }}
            alignItems="flex-end"
          >
            {/* Left column: Identity block */}
            <GridItem>
              {identity}
            </GridItem>

            {/* Right column: Actions */}
            {actions && (
              <GridItem>
                {actions}
              </GridItem>
            )}
          </Grid>

          {/* Optional stats row below main grid */}
          {stats && (
            <Box mt={{ base: 3, md: 4 }}>
              {stats}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
