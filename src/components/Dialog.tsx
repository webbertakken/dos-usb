"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";

type DialogName =
  /** Shown as the dialog's heading, and its accessible name. */
  | { title: string; labelledBy?: never }
  /** The id of a heading the content shows itself. */
  | { labelledBy: string; title?: never };

type DialogProps = DialogName & {
  onClose: () => void;
  children: React.ReactNode;
  /** Something to show above the content, edge to edge (a screenshot). */
  hero?: React.ReactNode;
  size?: "md" | "lg";
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog, the native one: the page behind it is inert, focus moves in
 * and stays in, Escape and the close button close it, and focus returns to
 * whatever opened it.
 */
const Dialog: React.FC<DialogProps> = ({
  title,
  labelledBy,
  onClose,
  children,
  hero,
  size = "md",
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  const ownTitleId = React.useId();
  const titleId = labelledBy ?? ownTitleId;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    const first = dialog?.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? dialog?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === firstItem || !inside)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (document.activeElement === lastItem || !inside)) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      dialog?.close();
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none items-end justify-center bg-transparent p-3 text-inherit backdrop:bg-transparent open:flex sm:items-center sm:p-6"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[#07060b]/80 backdrop-blur-sm motion-safe:animate-fade"
      />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl shadow-black/60 ring-1 ring-line motion-safe:animate-rise ${
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-night/80 text-paper ring-1 ring-line transition-colors hover:bg-raised"
        >
          <FaTimes aria-hidden="true" />
        </button>
        <div className="overflow-y-auto overscroll-contain">
          {hero}
          <div className="p-6 sm:p-8">
            {title !== undefined && (
              <h2
                id={titleId}
                className="mb-6 pr-12 font-display text-2xl font-bold tracking-tight text-paper"
              >
                {title}
              </h2>
            )}
            {children}
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default Dialog;
