"use client";

import { lazy, Suspense } from "react";
import { Box, Spinner } from "@chakra-ui/react";
import type { Discussion } from "@hiveio/dhive";

// Lazy load the heavy video component
const VerticalVideoFeed = lazy(() => import("./VerticalVideoFeed"));

interface VerticalVideoFeedLazyProps {
  comments: Discussion[];
  onClose: () => void;
  initialVideoSrc?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

const VerticalVideoFeedLazy: React.FC<VerticalVideoFeedLazyProps> = (props) => {
  return (
    <Suspense
      fallback={
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="black"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={9999}
        >
          <Spinner size="xl" color="white" />
        </Box>
      }
    >
      <VerticalVideoFeed {...props} />
    </Suspense>
  );
};

export default VerticalVideoFeedLazy;
