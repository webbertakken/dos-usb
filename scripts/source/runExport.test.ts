import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPSTREAM_URL } from "./exportSource";
import { exportSource } from "./runExport";

const git = (args: string[], cwd?: string) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

describe("exportSource", () => {
  let root: string;
  let repo: string;
  let target: string;
  const scanSecrets = vi.fn();
  const log = vi.fn();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "export-source-"));
    repo = path.join(root, "repo");
    target = path.join(root, "stick", "source");
    git(["init", "--quiet", "--initial-branch=main", repo]);
    fs.writeFileSync(path.join(repo, ".gitattributes"), "* text=auto eol=lf\n");
    fs.writeFileSync(path.join(repo, "README.md"), "line one\nline two\n");
    git(["add", "."], repo);
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "one"], repo);
    scanSecrets.mockReset();
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const run = () => exportSource({ sourceRepo: repo, targetDir: target, scanSecrets, log });

  it("writes a clean working copy of HEAD whose only remote is upstream", () => {
    const { sha } = run();

    expect(sha).toBe(git(["rev-parse", "HEAD"], repo));
    expect(git(["remote"], target)).toBe("upstream");
    expect(git(["remote", "get-url", "upstream"], target)).toBe(UPSTREAM_URL);
    expect(git(["rev-parse", "HEAD"], target)).toBe(sha);
    expect(git(["rev-parse", "--abbrev-ref", "HEAD"], target)).toBe("main");
    expect(git(["rev-parse", "--abbrev-ref", "main@{upstream}"], target)).toBe("upstream/main");
    expect(git(["status", "--porcelain"], target)).toBe("");
    expect(fs.readFileSync(path.join(target, "VERSION"), "utf8")).toBe(`${sha}\n`);
    expect(git(["config", "core.fileMode"], target)).toBe("false");
    expect(git(["config", "core.symlinks"], target)).toBe("false");
    expect(scanSecrets).toHaveBeenCalledOnce();
  });

  it("stays clean when checked out again with core.autocrlf=true", () => {
    run();
    fs.rmSync(path.join(target, "README.md"));
    git(["config", "core.autocrlf", "true"], target);
    git(["checkout", "--", "README.md"], target);

    expect(fs.readFileSync(path.join(target, "README.md"), "utf8")).toBe("line one\nline two\n");
    expect(git(["status", "--porcelain"], target)).toBe("");
  });

  it("replaces an earlier export", () => {
    run();
    fs.writeFileSync(path.join(repo, "README.md"), "changed\n");
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-am", "two"], repo);

    const { sha } = run();

    expect(git(["rev-parse", "HEAD"], target)).toBe(sha);
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
    expect(fs.existsSync(`${target}.previous`)).toBe(false);
  });

  it("refuses to replace a folder that is not an earlier export", () => {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "notes.txt"), "mine");

    expect(run).toThrow(/not an earlier source export/);
    expect(fs.readFileSync(path.join(target, "notes.txt"), "utf8")).toBe("mine");
  });

  it("refuses uncommitted changes, since no commit would match the build", () => {
    fs.writeFileSync(path.join(repo, "README.md"), "dirty\n");

    expect(run).toThrow(/uncommitted changes/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("refuses tracked files that must not ship", () => {
    fs.writeFileSync(path.join(repo, ".env"), "TOKEN=x\n");
    git(["add", ".env"], repo);
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "env"], repo);

    expect(run).toThrow(/\.env/);
  });

  it("refuses a working copy left unclean, such as by a scanner report", () => {
    scanSecrets.mockImplementation((dir: string) =>
      fs.writeFileSync(path.join(dir, "gitleaks-report.json"), "[]"),
    );

    expect(run).toThrow(/not clean/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("leaves no target behind when the secret scan fails", () => {
    scanSecrets.mockImplementation(() => {
      throw new Error("gitleaks found 1 leak");
    });

    expect(run).toThrow(/gitleaks/);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
  });
});
