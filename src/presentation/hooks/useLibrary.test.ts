import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLibrary } from "./useLibrary";
import type { CanonicalGame } from "../../domain/library/types";

const keen = { id: "keen", title: "Commander Keen" } as CanonicalGame;

describe("useLibrary", () => {
  it("is loading until the library arrives", async () => {
    const { result } = renderHook(() => useLibrary(() => Promise.resolve([keen])));

    expect(result.current).toMatchObject({ loading: true, error: null, library: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.library).toEqual([keen]);
  });

  it("reports a library that cannot be read, in the words the user sees", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useLibrary(() => Promise.reject(new Error("EIO"))));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load the game library: EIO");
    expect(console.error).toHaveBeenCalled();
  });

  it("tries again on request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi
      .fn<() => Promise<CanonicalGame[]>>()
      .mockRejectedValueOnce(new Error("EIO"))
      .mockResolvedValueOnce([keen]);
    const { result } = renderHook(() => useLibrary(load));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.retry());

    expect(result.current).toMatchObject({ loading: true, error: null });
    await waitFor(() => expect(result.current.library).toEqual([keen]));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
