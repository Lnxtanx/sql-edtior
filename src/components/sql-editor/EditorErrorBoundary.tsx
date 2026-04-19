/**
 * EditorErrorBoundary.tsx
 * 
 * Error Boundary for SQL Editor that catches and displays errors gracefully.
 * Handles permission errors, network errors, and parsing errors.
 */

import React, { ReactNode, ReactElement } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EditorErrorBoundaryProps {
  children: ReactNode;
  /**
   * Callback when error is caught (for logging)
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * Custom fallback UI
   */
  fallback?: (error: Error, retry: () => void) => ReactElement;
  /**
   * Whether to show error details (dev mode)
   */
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary for catching errors in the SQL Editor
 * 
 * Usage:
 * <EditorErrorBoundary>
 *   <SqlEditor />
 * </EditorErrorBoundary>
 * 
 * Or with callback:
 * <EditorErrorBoundary onError={(err, info) => logToSentry(err, info)}>
 *   <SqlEditor />
 * </EditorErrorBoundary>
 */
export class EditorErrorBoundary extends React.Component<EditorErrorBoundaryProps, State> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    console.error('Editor Error:', error, errorInfo);

    // Call optional error callback (for logging services)
    this.props.onError?.(error, errorInfo);

    // Update state
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  isPermissionError = (error: Error | null): boolean => {
    if (!error) return false;
    const msg = error.message.toLowerCase();
    return msg.includes('permission') || msg.includes('forbidden') || msg.includes('unauthorized');
  };

  isNetworkError = (error: Error | null): boolean => {
    if (!error) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('connection') ||
      msg.includes('timeout')
    );
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { error, errorInfo } = this.state;
      const { fallback, showDetails = false } = this.props;

      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      // Determine error type and message
      const isPermissionError = this.isPermissionError(error);
      const isNetworkError = this.isNetworkError(error);

      let title = 'Something went wrong';
      let description = error.message;
      let icon = <AlertTriangle className="w-5 h-5" />;

      if (isPermissionError) {
        title = 'Access Denied';
        description = 'You do not have permission to perform this action.';
      } else if (isNetworkError) {
        title = 'Network Error';
        description = 'Unable to connect. Please check your connection and try again.';
      }

      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-destructive/5">
          <div className="flex items-center gap-3 text-destructive">
            {icon}
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {showDetails && errorInfo && (
            <details className="w-full max-w-lg text-xs text-destructive/70 bg-background border border-destructive/20 rounded p-2">
              <summary className="cursor-pointer font-mono font-semibold">Details</summary>
              <pre className="mt-2 overflow-auto bg-muted p-2 rounded text-[10px] whitespace-pre-wrap break-words">
                {error.toString()}
                {'\n\n'}
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            {isNetworkError && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            )}
          </div>

          {isPermissionError && (
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              If you believe you should have access, contact your project owner.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version for functional components
 * Note: Error boundaries must be class components,
 * so this is mainly for convenience in checking if an error might occur
 */
export function useEditorErrorHandler() {
  const handleError = (error: Error) => {
    console.error('Editor error:', error);
    const isPermission = error.message.toLowerCase().includes('permission');
    const isNetwork = error.message.toLowerCase().includes('network');

    return {
      isPermissionError: isPermission,
      isNetworkError: isNetwork,
      error,
    };
  };

  return { handleError };
}

/**
 * Provider wrapper for consistent error handling
 */
export interface EditorErrorBoundaryProviderProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

export function EditorErrorBoundaryProvider({
  children,
  onError,
  showDetails,
}: EditorErrorBoundaryProviderProps) {
  return (
    <EditorErrorBoundary onError={onError} showDetails={showDetails}>
      {children}
    </EditorErrorBoundary>
  );
}
