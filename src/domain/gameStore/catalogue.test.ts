import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { loadCatalogue } from "./catalogue";
import type { DosgamesListItem } from "./types";

const sample: DosgamesListItem[] = [
  {
    id: "doom",
    title: "DOOM",
    description: "Shooter",
    year: "1993",
    category: "3D Shooting",
    image: "/screens/doom.gif",
    downloadUrl: "https://example.com/DOSBOX_DOOM.ZIP",
  },
];

describe("loadCatalogue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });

  it("uses the Electron catalogue when available", async () => {
    const getStoreCatalogue = vi.fn().mockResolvedValue(sample);
    (globalThis as Record<string, unknown>).window = { electron: { getStoreCatalogue } };

    const result = await loadCatalogue();

    expect(getStoreCatalogue).toHaveBeenCalledOnce();
    expect(result).toEqual(sample);
  });

  it("falls back to the static catalogue file when Electron returns nothing", async () => {
    const getStoreCatalogue = vi.fn().mockResolvedValue([]);
    (globalThis as Record<string, unknown>).window = { electron: { getStoreCatalogue } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadCatalogue();

    expect(fetchMock).toHaveBeenCalledWith("/catalogue.json");
    expect(result).toEqual(sample);
  });

  it("falls back to fetch when Electron is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadCatalogue();

    expect(result).toEqual(sample);
  });

  it("throws a clear error when the static fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadCatalogue()).rejects.toThrow(/404/);
  });
});
