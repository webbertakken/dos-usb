'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    console.error('React Error Boundary caught an error:', error, errorInfo);

    // Send error to main process if electron is available
    if (typeof window !== 'undefined' && window.electron?.logError) {
      window.electron.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-6 bg-red-900 rounded-lg m-4 text-white">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <pre className="mt-2 p-2 bg-red-950 rounded text-sm overflow-auto">
              {this.state.error?.message}
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md transition-colors"
            onClick={() => window.location.reload()}
          >
            Try reloading the application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
