"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import PixelArt from "./PixelArt";
import { buttonClass } from "./buttonStyles";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches a crashed screen and offers a calm way back: reload the app. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("React Error Boundary caught an error:", error, errorInfo);

    if (typeof window !== "undefined" && window.electron?.logError) {
      window.electron.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack ?? undefined,
      });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-night p-6">
        <div className="w-full max-w-lg rounded-3xl border border-line bg-panel p-8 text-center sm:p-10">
          <PixelArt name="crash" scale={5} className="mx-auto" />
          <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-paper">
            Something went wrong
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            DOS USB tripped over itself. Your games are safe on the stick. Reloading usually puts
            things right.
          </p>
          <button
            type="button"
            className={`${buttonClass("play", "lg")} mt-8 font-display font-extrabold`}
            onClick={() => window.location.reload()}
          >
            Reload DOS USB
          </button>
          <details className="mt-8 text-left text-sm text-muted">
            <summary className="w-fit cursor-pointer rounded underline decoration-faint underline-offset-4 hover:text-paper">
              Technical details
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-night p-3 text-xs">
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
