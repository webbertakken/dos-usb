import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useWelcome } from "./useWelcome";

const SEEN_KEY = "dos-usb:welcome-seen";

/** An in-memory stand-in: Node's own, unconfigured localStorage shadows happy-dom's. */
const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const Probe = () => (useWelcome().visible ? "visible" : "hidden");

describe("useWelcome", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("shows the welcome on a computer that has not seen it", () => {
    const { result } = renderHook(() => useWelcome());

    expect(result.current.visible).toBe(true);
  });

  it("stays hidden on a computer that has seen it", () => {
    window.localStorage.setItem(SEEN_KEY, "yes");

    const { result } = renderHook(() => useWelcome());

    expect(result.current.visible).toBe(false);
  });

  it("hides once dismissed, and remembers it", () => {
    const { result } = renderHook(() => useWelcome());

    act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("yes");
  });

  it("opens again on request, and hides when dismissed again", () => {
    window.localStorage.setItem(SEEN_KEY, "yes");
    const { result } = renderHook(() => useWelcome());

    act(() => result.current.reopen());
    expect(result.current.visible).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
  });
});

describe("useWelcome while prerendering", () => {
  it("stays hidden, so the static export never flashes the welcome", () => {
    expect(renderToString(createElement(Probe))).toBe("hidden");
  });
});
