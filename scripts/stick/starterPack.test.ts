import { describe, expect, it } from "vitest";
import type { CanonicalGame } from "../../src/domain/library/types";
import { parseStarterPack, resolveStarterPack } from "./starterPack";

const game = (id: string, downloadUrl?: string): CanonicalGame =>
  ({
    id,
    title: id.toUpperCase(),
    year: "1990",
    category: "Action",
    description: "",
    image: `/screens/${id}.gif`,
    sources: [
      {
        site: "dosgames",
        siteName: "DOSGames.com",
        title: id,
        year: "1990",
        url: "https://example.com",
        downloadUrl,
        runExe: "GO.EXE",
        metrics: {},
      },
    ],
  }) as unknown as CanonicalGame;

describe("parseStarterPack", () => {
  it("reads a list of library ids", () => {
    expect(parseStarterPack('[{ "id": "a" }, { "id": "b" }]')).toEqual({
      ok: true,
      ids: ["a", "b"],
    });
  });

  it.each(['{"id":"a"}', '[{"name":"a"}]', '[{"id":""}]', "not json"])(
    "rejects %j, which is not [{ id: string }]",
    (text) => {
      expect(parseStarterPack(text)).toMatchObject({ ok: false });
    },
  );

  it("rejects ids FAT cannot hold as folder names", () => {
    expect(parseStarterPack('[{ "id": "a:b" }]')).toMatchObject({ ok: false });
  });

  it("rejects duplicate ids", () => {
    expect(parseStarterPack('[{ "id": "a" }, { "id": "a" }]')).toMatchObject({ ok: false });
  });
});

describe("resolveStarterPack", () => {
  const library = [
    game("zip", "https://x/GAME.ZIP"),
    game("page", "https://x/game/page/"),
    game("nodl"),
  ];

  it("turns each id into the payload the app's downloader takes", () => {
    expect(resolveStarterPack(["zip"], library)).toEqual({
      ok: true,
      games: [
        {
          id: "zip",
          title: "ZIP",
          description: "",
          year: "1990",
          category: "Action",
          image: "/screens/zip.gif",
          downloadUrl: "https://x/GAME.ZIP",
          runExe: "GO.EXE",
        },
      ],
    });
  });

  it("reports every id it cannot put on a stick, and why", () => {
    expect(resolveStarterPack(["missing", "nodl", "page"], library)).toEqual({
      ok: false,
      problems: [
        "missing: not in the library",
        "nodl: no source offers a download",
        "page: https://x/game/page/ is not a direct .zip download",
      ],
    });
  });

  it("accepts an Internet Archive item, which resolves to its zip", () => {
    const archive = game("ia", "https://archive.org/download/item/item.zip");
    expect(resolveStarterPack(["ia"], [archive]).ok).toBe(true);
  });
});
