/**
 * Error Handling Service
 * Handles error logging and management across the application
 */

import { ErrorData, ErrorHandlingService, ErrorSeverity } from "./types";

// Define a type that matches what the Electron bridge expects
interface ElectronErrorData {
  message?: string;
  stack?: string;
  componentStack?: string;
  [key: string]: string | undefined;
}

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
        const electronErrorData: ElectronErrorData = {
          message: errorWithSeverity.message,
          stack: errorWithSeverity.stack,
          componentStack: errorWithSeverity.componentStack,
          // Convert severity to string for compatibility
          severityLevel: severity.toString(),
          // Include any other string properties
          ...this.convertToStringValues(errorWithSeverity),
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

  /**
   * Converts all values in an object to strings if they're not undefined
   */
  private convertToStringValues(
    obj: Record<string, unknown>
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        result[key] = undefined;
      } else if (typeof value === "object" && value !== null) {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }

    return result;
  }
}
