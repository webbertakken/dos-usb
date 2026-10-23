import { describe, it, expect } from "vitest";
import { Welcome } from "./welcome";

describe("Welcome.greeting", () => {
  it("wishes the named recipient a happy birthday", () => {
    expect(Welcome.greeting({ recipientName: "Sam" })).toBe("Happy birthday, Sam!");
  });

  it("wishes a happy birthday when the gift names nobody", () => {
    expect(Welcome.greeting({ message: "Enjoy" })).toBe("Happy birthday!");
  });

  it("welcomes plainly when there is no gift message", () => {
    expect(Welcome.greeting(null)).toBe("Welcome to DOS USB");
  });
});

describe("Welcome.signature", () => {
  it("signs with the sender", () => {
    expect(Welcome.signature({ from: "Webber" })).toBe("With love, Webber");
  });

  it("has no signature without a sender", () => {
    expect(Welcome.signature({ message: "Enjoy" })).toBeNull();
    expect(Welcome.signature(null)).toBeNull();
  });
});

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("Welcome seen state", () => {
  it("is unseen on first launch", () => {
    expect(Welcome.hasBeenSeen(memoryStorage())).toBe(false);
  });

  it("is seen once marked", () => {
    const storage = memoryStorage();

    Welcome.markSeen(storage);

    expect(Welcome.hasBeenSeen(storage)).toBe(true);
  });

  it("counts as unseen when storage is unavailable", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(Welcome.hasBeenSeen(broken)).toBe(false);
    expect(() => Welcome.markSeen(broken)).not.toThrow();
  });
});
