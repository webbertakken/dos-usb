import { useCallback, useEffect, useRef, useState } from "react";
import type { CanonicalGame } from "../../domain/library/types";

/** How one attempt to load the library ended. */
type Outcome = {
  attempt: number;
  library: CanonicalGame[];
  error: string | null;
};

/** The aggregated library, loaded once, with a way to try again after a failure. */
export function useLibrary(load: () => Promise<CanonicalGame[]>) {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const loadRef = useRef(load);

  useEffect(() => {
    let current = true;
    loadRef
      .current()
      .then((library) => {
        if (current) setOutcome({ attempt, library, error: null });
      })
      .catch((cause: unknown) => {
        console.error("Error loading library:", cause);
        const reason = cause instanceof Error ? cause.message : String(cause);
        if (current) {
          setOutcome({
            attempt,
            library: [],
            error: `Failed to load the game library: ${reason}`,
          });
        }
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const settled = outcome?.attempt === attempt ? outcome : null;
  return {
    library: settled?.library ?? [],
    loading: settled === null,
    error: settled?.error ?? null,
    retry,
  };
}
