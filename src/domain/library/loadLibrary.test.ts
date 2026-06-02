import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { loadLibrary } from "./loadLibrary";
import type { CanonicalGame } from "./types";

const sample: CanonicalGame[] = [
  {
    id: "doom-1993",
    title: "DOOM",
    year: "1993",
    category: "Shooter",
    tags: [],
    mature: true,
    popularity: 1,
    sources: [],
  },
];

describe("loadLibrary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });

  it("uses the Electron library when available", async () => {
    const getLibrary = vi.fn().mockResolvedValue(sample);
    (globalThis as Record<string, unknown>).window = { electron: { getLibrary } };
    expect(await loadLibrary()).toEqual(sample);
    expect(getLibrary).toHaveBeenCalledOnce();
  });

  it("falls back to the static file when Electron is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadLibrary()).toEqual(sample);
    expect(fetchMock).toHaveBeenCalledWith("/library.json");
  });

  it("throws a clear error when the static fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadLibrary()).rejects.toThrow(/500/);
  });
});
