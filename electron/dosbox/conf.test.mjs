import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOSBOX_CONF,
  displaySettingsFor,
  generateDosboxConf,
  mergeDosboxConf,
} from "./conf.mjs";

const generated = [
  "[sdl]",
  "fullscreen=false",
  "windowresolution=1280x960",
  "",
  "[dosbox]",
  "machine=svga_s3",
  "memsize=16",
  "",
  "[cpu]",
  "core=auto",
  "cycles=auto",
  "",
  "[autoexec]",
  "@echo off",
  'mount c "/stick/games/doom"',
  "c:",
  "DOOM.EXE",
  "",
].join("\n");

describe("mergeDosboxConf", () => {
  it("returns the generated config unchanged in shape when there is no override", () => {
    const { text, applied, ignored } = mergeDosboxConf(generated, "");

    expect(text).toBe(
      [
        "[sdl]",
        "fullscreen=false",
        "windowresolution=1280x960",
        "",
        "[dosbox]",
        "machine=svga_s3",
        "memsize=16",
        "",
        "[cpu]",
        "core=auto",
        "cycles=auto",
        "",
        "[autoexec]",
        "@echo off",
        'mount c "/stick/games/doom"',
        "c:",
        "DOOM.EXE",
        "",
      ].join("\n"),
    );
    expect(applied).toEqual([]);
    expect(ignored).toEqual([]);
  });

  it("lets an override key win over the generated one, in place", () => {
    const { text, applied } = mergeDosboxConf(generated, "[cpu]\ncycles=fixed 3000\n");

    expect(text).toContain("[cpu]\ncore=auto\ncycles=fixed 3000\n");
    expect(text).not.toContain("cycles=auto");
    expect(applied).toEqual(["cpu.cycles"]);
  });

  it("keeps generated keys the override does not mention", () => {
    const { text } = mergeDosboxConf(generated, "[dosbox]\nmachine=cga\n");

    expect(text).toContain("[dosbox]\nmachine=cga\nmemsize=16\n");
  });

  it("adds keys and sections the generated config lacks, before autoexec", () => {
    const { text, applied } = mergeDosboxConf(
      generated,
      "[cpu]\ncputype=386\n\n[mixer]\nrate=44100\n",
    );

    expect(text).toContain("[cpu]\ncore=auto\ncycles=auto\ncputype=386\n");
    expect(text.indexOf("[mixer]\nrate=44100")).toBeLessThan(text.indexOf("[autoexec]"));
    expect(applied).toEqual(["cpu.cputype", "mixer.rate"]);
  });

  it("replaces the generated autoexec wholesale with the override's", () => {
    const { text, applied } = mergeDosboxConf(
      generated,
      '[autoexec]\nmount c "/stick/games/doom"\nc:\nSETUP.EXE\n',
    );

    expect(text.endsWith('[autoexec]\nmount c "/stick/games/doom"\nc:\nSETUP.EXE\n')).toBe(true);
    expect(text).not.toContain("DOOM.EXE");
    expect(applied).toEqual(["autoexec"]);
  });

  it("matches section and key names case-insensitively and trims around =", () => {
    const { text, applied } = mergeDosboxConf(generated, "[CPU]\n  Cycles = max  \n");

    expect(text).toContain("[cpu]\ncore=auto\ncycles=max\n");
    expect(applied).toEqual(["cpu.cycles"]);
  });

  it("skips comments and blank lines outside autoexec", () => {
    const { text, applied, ignored } = mergeDosboxConf(
      generated,
      "# slow it down for the intro\n[cpu]\n; cycles were too fast\n\ncycles=fixed 1000\n",
    );

    expect(text).toContain("cycles=fixed 1000");
    expect(text).not.toContain("intro");
    expect(applied).toEqual(["cpu.cycles"]);
    expect(ignored).toEqual([]);
  });

  it("keeps comments and blank lines inside the override autoexec", () => {
    const { text } = mergeDosboxConf(generated, "[autoexec]\n# go\n\nc:\n");

    expect(text.endsWith("[autoexec]\n# go\n\nc:\n")).toBe(true);
  });

  it("reports lines it cannot use instead of dropping them silently", () => {
    const { ignored, applied } = mergeDosboxConf(generated, "cycles=max\n[cpu]\nturbo\n");

    expect(ignored).toEqual(["line 1 (outside any section): cycles=max", "line 3 ([cpu]): turbo"]);
    expect(applied).toEqual([]);
  });

  it("folds a section that appears twice into its first position, later keys winning", () => {
    const { text } = mergeDosboxConf(
      "[cpu]\ncycles=auto\n[dosbox]\nmemsize=16\n[cpu]\ncycles=max\n",
      "",
    );

    expect(text).toBe("[cpu]\ncycles=max\n\n[dosbox]\nmemsize=16\n");
  });

  it("reads Windows line endings", () => {
    const { text, applied } = mergeDosboxConf(generated, "[cpu]\r\ncycles=max\r\n");

    expect(text).toContain("cycles=max\n");
    expect(text).not.toContain("\r");
    expect(applied).toEqual(["cpu.cycles"]);
  });

  it("reports a key set twice in the override once, the last value winning", () => {
    const { text, applied } = mergeDosboxConf(generated, "[cpu]\ncycles=max\ncycles=fixed 2000\n");

    expect(text).toContain("cycles=fixed 2000\n");

    expect(applied).toEqual(["cpu.cycles"]);
  });
});

describe("displaySettingsFor", () => {
  it.each([
    [
      { width: 1280, height: 960 },
      { scaler: "normal3x", memsize: 16, cycles: "auto" },
    ],
    [
      { width: 1600, height: 1200 },
      { scaler: "advmame3x", memsize: 32, cycles: "max" },
    ],
    [
      { width: 2048, height: 1536 },
      { scaler: "hq3x", memsize: 64, cycles: "max" },
    ],
  ])("tunes a %o window", (window, tier) => {
    expect(displaySettingsFor(window)).toEqual({
      windowresolution: `${window.width}x${window.height}`,
      ...tier,
    });
  });
});

describe("generateDosboxConf", () => {
  it("lays display tuning and the autoexec over the defaults", () => {
    const text = generateDosboxConf({
      window: { width: 1600, height: 1200 },
      autoexec: '@echo off\nmount c "/stick/games/doom"\nc:\nDOOM.EXE\n',
    });

    expect(text).toContain("windowresolution=1600x1200\n");
    expect(text).toContain("[render]\nframeskip=0\naspect=true\nscaler=advmame3x\n");
    expect(text).toContain("cycles=max\n");
    expect(text).toContain("machine=svga_s3\n");
    expect(
      text.endsWith('[autoexec]\n@echo off\nmount c "/stick/games/doom"\nc:\nDOOM.EXE\n'),
    ).toBe(true);
    expect(text.match(/^\[cpu\]$/gm)).toHaveLength(1);
  });

  it("keeps the ultrasound path's single backslash", () => {
    expect(DEFAULT_DOSBOX_CONF).toContain("ultradir=C:\\ULTRASND\n");
  });
});
