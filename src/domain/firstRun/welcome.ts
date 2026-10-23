/**
 * The first-launch welcome: a greeting, the optional birthday message from
 * `gift.json`, and whether this computer has already seen it.
 */

export type GiftMessage = {
  readonly recipientName?: string;
  readonly message?: string;
  readonly from?: string;
};

export type WelcomeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const SEEN_KEY = "dos-usb:welcome-seen";

export const Welcome = {
  greeting: (gift: GiftMessage | null): string => {
    if (!gift) return "Welcome to DOS USB";
    return gift.recipientName ? `Happy birthday, ${gift.recipientName}!` : "Happy birthday!";
  },

  signature: (gift: GiftMessage | null): string | null =>
    gift?.from ? `With love, ${gift.from}` : null,

  hasBeenSeen: (storage: WelcomeStorage): boolean => {
    try {
      return storage.getItem(SEEN_KEY) === "yes";
    } catch (error) {
      console.warn("[welcome] could not read the welcome state:", error);
      return false;
    }
  },

  markSeen: (storage: WelcomeStorage): void => {
    try {
      storage.setItem(SEEN_KEY, "yes");
    } catch (error) {
      console.warn("[welcome] could not remember the welcome was seen:", error);
    }
  },
} as const;
