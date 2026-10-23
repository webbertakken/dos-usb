import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const YARN_BUILTINS = new Set(["install"]);

const yarnCommandsIn = (markdown: string): string[] =>
  [...markdown.matchAll(/\byarn ([a-z][\w:-]*)/g)].map((match) => match[1]);

const relativeLinkTargetsIn = (markdown: string): string[] =>
  [...markdown.matchAll(/\]\((\.{1,2}\/[^)#\s]+)/g)].map((match) => match[1]);

const navigationLabels = (): string[] => {
  const navigation = readFileSync(path.join(repoRoot, "src/components/Navigation.tsx"), "utf8");
  return [...navigation.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);
};

const usageSections = (markdown: string): string[] => {
  const usage = markdown.split(/^## Usage$/m)[1]?.split(/^## /m)[0] ?? "";
  return [...usage.matchAll(/^### (.+)$/gm)].map((match) => match[1]);
};

describe("README", () => {
  it("names only yarn commands that package.json defines", () => {
    const commands = yarnCommandsIn(readme);

    const unknown = commands.filter(
      (command) => !YARN_BUILTINS.has(command) && !(command in packageJson.scripts),
    );

    expect(commands.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });

  it("uses yarn, never npm or npx", () => {
    expect(readme).not.toMatch(/\bnpm run\b|\bnpx\b/);
  });

  it("links only to files that exist", () => {
    const missing = relativeLinkTargetsIn(readme).filter(
      (target) => !existsSync(path.join(repoRoot, target)),
    );

    expect(missing).toEqual([]);
  });

  it("describes exactly the pages the navigation offers", () => {
    expect(usageSections(readme)).toEqual(navigationLabels());
  });
});
