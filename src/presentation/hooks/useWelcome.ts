import { useState, useSyncExternalStore } from "react";
import { Welcome } from "../../domain/firstRun/welcome";

const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const markSeen = () => {
  Welcome.markSeen(window.localStorage);
  listeners.forEach((onChange) => onChange());
};

/**
 * Whether the first-launch welcome shows: until this computer has dismissed
 * it, and again whenever it is reopened.
 */
export function useWelcome() {
  const seen = useSyncExternalStore(
    subscribe,
    () => Welcome.hasBeenSeen(window.localStorage),
    () => true,
  );
  const [reopened, setReopened] = useState(false);

  return {
    visible: reopened || !seen,
    dismiss: () => {
      setReopened(false);
      markSeen();
    },
    reopen: () => setReopened(true),
  };
}
