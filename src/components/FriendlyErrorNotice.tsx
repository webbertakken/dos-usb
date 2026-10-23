import React from "react";
import { FaExclamationCircle, FaTimes } from "react-icons/fa";
import { friendlyError } from "../domain/firstRun/friendlyError";

interface FriendlyErrorNoticeProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/** An error in plain language, with the raw text tucked away for helpers. */
const FriendlyErrorNotice: React.FC<FriendlyErrorNoticeProps> = ({ error, onRetry, onDismiss }) => {
  const { message, detail } = friendlyError(error);

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-4 rounded-lg border border-amber-500 bg-amber-950 p-4 text-amber-50"
    >
      <FaExclamationCircle className="mt-1 shrink-0 text-2xl text-amber-300" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-lg">{message}</p>
        {detail && (
          <details className="mt-2 text-sm text-amber-100">
            <summary className="cursor-pointer underline">Technical details</summary>
            <p className="mt-1 font-mono break-words">{detail}</p>
          </details>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close message"
          className="rounded-md p-2 text-amber-100 hover:bg-amber-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
        >
          <FaTimes aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default FriendlyErrorNotice;
