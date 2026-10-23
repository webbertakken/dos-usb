import { describe, expect, it } from "vitest";
import { STICK_NAMES } from "./plan";
import { renderStartHere } from "./startHere";

describe("renderStartHere", () => {
  const html = renderStartHere([{ title: "Commander Keen" }, { title: "Captain <Comic> & co" }]);

  it("is a complete, English, dark-mode-aware page", () => {
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("names the one file to open on each computer", () => {
    expect(html).toContain(STICK_NAMES.windowsExe);
    expect(html).toContain(STICK_NAMES.linuxAppImage);
  });

  it("lists the games already on the stick, escaped", () => {
    expect(html).toContain("<li>Commander Keen</li>");
    expect(html).toContain("<li>Captain &lt;Comic&gt; &amp; co</li>");
  });

  it("says the starter games need no internet", () => {
    expect(html).toMatch(/no internet/i);
  });

  it("tells the recipient where their own games go", () => {
    expect(html).toContain("games-custom");
  });

  it("leaves out the game list when the stick has none", () => {
    expect(renderStartHere([])).not.toContain("<ul");
  });
});
