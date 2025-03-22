/**
 * useErrorHandling Hook
 * React hook for error handling in the UI
 */

import { useEffect, useState } from "react";
import { ErrorAdapter, ErrorViewModel } from "../adapters/ErrorAdapter";
import { useErrorHandlingStore } from "../../application/stores";
import { ErrorSeverity } from "../../domain/errorHandling/types";

/**
 * Custom hook that provides error handling functionality for UI components
 */
export function useErrorHandling() {
  // Get state from the store
  const { errors, hasErrors } = useErrorHandlingStore();

  // Local state for UI
  const [errorViewModels, setErrorViewModels] = useState<ErrorViewModel[]>([]);

  // Update view models when store data changes
  useEffect(() => {
    setErrorViewModels(ErrorAdapter.getErrors());
  }, [errors]);

  // Handler functions for UI
  const handleLogError = (
    message: string,
    details?: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) => {
    return ErrorAdapter.logError(message, details, severity);
  };

  const handleDismissError = (id: number) => {
    ErrorAdapter.dismissError(id);
  };

  const handleClearAllErrors = () => {
    ErrorAdapter.clearErrors();
  };

  return {
    // Error data
    errors: errorViewModels,
    hasErrors,

    // Actions
    logError: handleLogError,
    dismissError: handleDismissError,
    clearAllErrors: handleClearAllErrors,

    // Severity levels for convenience
    severityLevels: {
      LOW: ErrorSeverity.LOW,
      MEDIUM: ErrorSeverity.MEDIUM,
      HIGH: ErrorSeverity.HIGH,
      CRITICAL: ErrorSeverity.CRITICAL,
    },
  };
}
