import { describe, expect, it } from "vitest";
import { UPSTREAM_URL, forbiddenPaths, parseExportArgs, workingCopySteps } from "./exportSource";

describe("parseExportArgs", () => {
  it("takes the one target directory", () => {
    expect(parseExportArgs(["/media/stick/source"])).toEqual({
      ok: true,
      targetDir: "/media/stick/source",
    });
  });

  it.each([[[]], [["a", "b"]], [[""]]])("refuses %o", (argv) => {
    expect(parseExportArgs(argv)).toEqual({
      ok: false,
      error: "usage: yarn export-source <targetDir>",
    });
  });
});

describe("forbiddenPaths", () => {
  it("passes ordinary source files", () => {
    expect(forbiddenPaths(["src/app/page.tsx", "public/screens/secret-agent.png"])).toEqual([]);
  });

  it("flags dependencies, games, env files and keys", () => {
    expect(
      forbiddenPaths([
        "node_modules/x/index.js",
        "games/doom/DOOM.EXE",
        ".env",
        "config/.env.local",
        "deploy/id_rsa",
        "certs/server.pem",
        "src/ok.ts",
      ]),
    ).toEqual([
      "node_modules/x/index.js",
      "games/doom/DOOM.EXE",
      ".env",
      "config/.env.local",
      "deploy/id_rsa",
      "certs/server.pem",
    ]);
  });
});

describe("workingCopySteps", () => {
  it("builds a FAT-safe working copy whose only remote is upstream, at the build commit", () => {
    expect(
      workingCopySteps({ sourceRepo: "/repo", sha: "abc123", workingCopy: "/stick/source" }),
    ).toEqual([
      ["init", "--quiet", "--initial-branch=main", "/stick/source"],
      ["-C", "/stick/source", "config", "core.fileMode", "false"],
      ["-C", "/stick/source", "config", "core.symlinks", "false"],
      ["-C", "/stick/source", "remote", "add", "upstream", UPSTREAM_URL],
      [
        "-C",
        "/stick/source",
        "fetch",
        "--quiet",
        "--no-tags",
        "/repo",
        "abc123:refs/remotes/upstream/main",
      ],
      ["-C", "/stick/source", "switch", "--quiet", "--create", "main", "--track", "upstream/main"],
    ]);
  });

  it("points upstream at the public HTTPS URL, without credentials", () => {
    expect(UPSTREAM_URL).toBe("https://github.com/webbertakken/dos-usb.git");
  });
});
