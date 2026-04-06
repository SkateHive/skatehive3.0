'use client';

import React from 'react';
import { Box, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, HStack, Text } from '@chakra-ui/react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
  /** Called when user clicks "Report Bug". Wire up to openReport from ReportContext. */
  onReport?: (error: Error, componentStack: string) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReport = () => {
    const { error, errorInfo } = this.state;
    if (error && this.props.onReport) {
      this.props.onReport(error, errorInfo?.componentStack ?? '');
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <Box p={4} maxW="lg" mx="auto" mt={8}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Something went wrong!</AlertTitle>
              <AlertDescription display="block" mt={2}>
                An unexpected error occurred while loading this page.
              </AlertDescription>
              <HStack mt={4} spacing={2} flexWrap="wrap">
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  onClick={this.resetError}
                >
                  Try Again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
                {this.props.onReport && (
                  <Button
                    size="sm"
                    colorScheme="orange"
                    variant="ghost"
                    onClick={this.handleReport}
                  >
                    Report Bug
                  </Button>
                )}
              </HStack>
            </Box>
          </Alert>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Box mt={4} p={4} bg="gray.100" borderRadius="md" fontSize="sm">
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  Error Details (Development)
                </summary>
                <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.stack}
                </pre>
              </details>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// ---------------------------------------------------------------------------
// ErrorBoundaryWithReport — wires ErrorBoundary to ReportContext automatically.
// Use this in feature components instead of the bare ErrorBoundary.
//
// Usage:
//   import ErrorBoundaryWithReport from "@/components/shared/ErrorBoundary";
//   <ErrorBoundaryWithReport><FeedCard /></ErrorBoundaryWithReport>
// ---------------------------------------------------------------------------

import { useReport } from '@/contexts/ReportContext';

export function ErrorBoundaryWithReport({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}) {
  const { openReport } = useReport();

  function handleReport(error: Error, componentStack: string) {
    openReport({
      type: 'bug',
      prefillTitle: `Component crash: ${error.message.slice(0, 60)}`,
      prefillDescription: `A component crashed unexpectedly.\n\nError: ${error.message}\n\nComponent stack:${componentStack}`,
      errorStack: error.stack,
    });
  }

  return (
    <ErrorBoundary fallback={fallback} onReport={handleReport}>
      {children}
    </ErrorBoundary>
  );
}
