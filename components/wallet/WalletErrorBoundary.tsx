"use client";
import { Component, ErrorInfo, ReactNode } from "react";
import { Box, Text, Button } from "@chakra-ui/react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class WalletErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WalletErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box border="2px solid" borderColor="error" p={6} textAlign="center" fontFamily="mono">
          <Text color="error" fontWeight="black" fontSize="sm" textTransform="uppercase" letterSpacing="widest" mb={2}>
            Wallet Error
          </Text>
          <Text color="dim" fontSize="xs" mb={4}>
            {this.state.error?.message ?? "Something went wrong loading the wallet."}
          </Text>
          <Button
            size="sm" borderRadius="none" colorScheme="red" variant="outline"
            fontFamily="mono" fontWeight="black" letterSpacing="wide"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
