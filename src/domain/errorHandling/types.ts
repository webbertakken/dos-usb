/**
 * Error Handling Domain Types
 * Contains types related to error management across the application
 */

export interface ErrorData {
  message?: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ErrorHandlingService {
  logError: (error: ErrorData, severity?: ErrorSeverity) => Promise<void>;
  getLastError: () => ErrorData | null;
  clearErrors: () => void;
}
