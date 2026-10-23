import React from "react";
import { FaExclamation, FaTimes } from "react-icons/fa";
import { friendlyError } from "../domain/firstRun/friendlyError";
import { buttonClass } from "./buttonStyles";

interface FriendlyErrorNoticeProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** A toast floats above the page, so nothing beneath it moves. */
  floating?: boolean;
}

/** An error in plain language, with the raw text tucked away for helpers. */
const FriendlyErrorNotice: React.FC<FriendlyErrorNoticeProps> = ({
  error,
  onRetry,
  onDismiss,
  floating = false,
}) => {
  const { message, detail } = friendlyError(error);

  return (
    <div
      role="alert"
      className={`flex items-start gap-4 rounded-2xl border border-amber/50 bg-panel p-5 text-paper ${
        floating
          ? "fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg shadow-2xl shadow-black/60 motion-safe:animate-rise sm:inset-x-auto sm:bottom-6 sm:right-6"
          : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink"
      >
        <FaExclamation />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-snug">{message}</p>
        {detail && (
          <details className="group mt-2 text-sm text-muted">
            <summary className="w-fit cursor-pointer rounded underline decoration-faint underline-offset-4 hover:text-paper">
              Technical details
            </summary>
            <p className="mt-2 break-words rounded-lg bg-night p-3 font-pixel text-lg leading-snug text-muted">
              {detail}
            </p>
          </details>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className={`${buttonClass("warn")} mt-4`}>
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close message"
          className={`${buttonClass("quiet", "sm")} -mr-2 -mt-1 w-9 px-0`}
        >
          <FaTimes aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default FriendlyErrorNotice;
