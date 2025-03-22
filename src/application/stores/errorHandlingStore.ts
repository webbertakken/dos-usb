/**
 * Error Handling Store
 * Application layer store for error handling features
 */

import { create } from "zustand";
import { ErrorData, ErrorSeverity } from "../../domain/errorHandling/types";
import { ElectronErrorHandlingService } from "../../domain/errorHandling/service";

interface ErrorHandlingState {
  errors: ErrorData[];
  hasErrors: boolean;

  // Actions
  logError: (error: ErrorData, severity?: ErrorSeverity) => Promise<void>;
  clearErrors: () => void;
  dismissError: (index: number) => void;
}

// Initialize service
const errorHandlingService = new ElectronErrorHandlingService();

export const useErrorHandlingStore = create<ErrorHandlingState>((set) => ({
  errors: [],
  hasErrors: false,

  logError: async (error: ErrorData, severity?: ErrorSeverity) => {
    try {
      // Log error through the service
      await errorHandlingService.logError(error, severity);

      // Add error to the store
      set((state) => ({
        errors: [...state.errors, error],
        hasErrors: true,
      }));
    } catch (e) {
      // If error handling fails, log to console as a fallback
      console.error("Error handling system failed:", e);
    }
  },

  clearErrors: () => {
    errorHandlingService.clearErrors();
    set({ errors: [], hasErrors: false });
  },

  dismissError: (index: number) => {
    set((state) => {
      const newErrors = [...state.errors];
      newErrors.splice(index, 1);
      return {
        errors: newErrors,
        hasErrors: newErrors.length > 0,
      };
    });
  },
}));
