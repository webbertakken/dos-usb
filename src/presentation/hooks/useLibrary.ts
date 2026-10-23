import { useCallback, useEffect, useRef, useState } from "react";
import type { CanonicalGame } from "../../domain/library/types";

type LibraryState = {
  library: CanonicalGame[];
  loading: boolean;
  error: string | null;
};

/** The aggregated library, loaded once, with a way to try again after a failure. */
export function useLibrary(load: () => Promise<CanonicalGame[]>) {
  const [state, setState] = useState<LibraryState>({ library: [], loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    let current = true;
    loadRef
      .current()
      .then((library) => {
        if (current) setState({ library, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        console.error("Error loading library:", cause);
        const reason = cause instanceof Error ? cause.message : String(cause);
        if (current) {
          setState({
            library: [],
            loading: false,
            error: `Failed to load the game library: ${reason}`,
          });
        }
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ library: [], loading: true, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
