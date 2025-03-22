/**
 * Error Adapter
 * Presentation layer adapter to connect error handling components with domain services
 */

import { ErrorData, ErrorSeverity } from "../../domain/errorHandling/types";
import { useErrorHandlingStore } from "../../application/stores";

/**
 * View model for displaying errors in the UI
 */
export interface ErrorViewModel {
  id: number;
  message: string;
  details?: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
}

/**
 * Error Adapter provides methods to transform domain error objects
 * to view models and to interact with the error handling store
 */
export class ErrorAdapter {
  /**
   * Transforms a domain error to a view model for UI display
   */
  static toErrorViewModel(error: ErrorData, index: number): ErrorViewModel {
    return {
      id: index,
      message: error.message || "Unknown error",
      details: error.stack,
      severity: (error.severity as ErrorSeverity) || ErrorSeverity.MEDIUM,
      timestamp: new Date(),
    };
  }

  /**
   * Gets all current errors as view models
   */
  static getErrors(): ErrorViewModel[] {
    const errorStore = useErrorHandlingStore.getState();
    return errorStore.errors.map((error, index) =>
      this.toErrorViewModel(error, index)
    );
  }

  /**
   * Logs a new error
   */
  static logError(
    message: string,
    details?: string,
    severity?: ErrorSeverity
  ): Promise<void> {
    const error: ErrorData = {
      message,
      stack: details,
      timestamp: new Date().toISOString(),
    };

    return useErrorHandlingStore.getState().logError(error, severity);
  }

  /**
   * Dismisses an error by index
   */
  static dismissError(index: number): void {
    useErrorHandlingStore.getState().dismissError(index);
  }

  /**
   * Clears all errors
   */
  static clearErrors(): void {
    useErrorHandlingStore.getState().clearErrors();
  }

  /**
   * Checks if there are any errors
   */
  static hasErrors(): boolean {
    return useErrorHandlingStore.getState().hasErrors;
  }
}
