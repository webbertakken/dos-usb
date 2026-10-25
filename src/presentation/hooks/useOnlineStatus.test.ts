import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useOnlineStatus } from "./useOnlineStatus";

const setOnline = (online: boolean) => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

describe("useOnlineStatus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("follows the computer going offline and back online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => setOnline(false));
    expect(result.current).toBe(false);

    act(() => setOnline(true));
    expect(result.current).toBe(true);
  });
});

const Probe = () => (useOnlineStatus() ? "online" : "offline");

describe("useOnlineStatus while prerendering", () => {
  it("assumes online, so the static export never shows an offline flash", () => {
    expect(renderToString(createElement(Probe))).toBe("online");
  });
});
