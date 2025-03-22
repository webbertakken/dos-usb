/**
 * Error Handling Service
 * Handles error logging and management across the application
 */

import { ErrorData, ErrorHandlingService, ErrorSeverity } from "./types";

/**
 * Electron implementation of the ErrorHandlingService
 */
export class ElectronErrorHandlingService implements ErrorHandlingService {
  private lastError: ErrorData | null = null;

  async logError(
    error: ErrorData,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<void> {
    this.lastError = error;

    // Add severity to the error data
    const errorWithSeverity: ErrorData = {
      ...error,
      severity,
    };

    console.error(`[${severity.toUpperCase()}]`, errorWithSeverity);

    // If in Electron environment, send to main process
    if (typeof window !== "undefined" && window.electron) {
      try {
        // Convert to format expected by electron bridge
        const electronErrorData: ErrorData = {
          message: errorWithSeverity.message,
          stack: errorWithSeverity.stack,
          componentStack: errorWithSeverity.componentStack,
          // Convert any non-string values to strings for compatibility
          severityLevel: severity,
        };

        await window.electron.logError(electronErrorData);
      } catch (err) {
        // Fallback to console if electron bridge fails
        console.error("Failed to send error to main process:", err);
      }
    }
  }

  getLastError(): ErrorData | null {
    return this.lastError;
  }

  clearErrors(): void {
    this.lastError = null;
  }
}
