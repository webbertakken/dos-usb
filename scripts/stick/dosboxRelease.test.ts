import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LINUX_DOSBOX_RELEASE, checksumProblem } from "./dosboxRelease";

describe("LINUX_DOSBOX_RELEASE", () => {
  it("pins one DOSBox Staging release by URL and SHA-256", () => {
    expect(LINUX_DOSBOX_RELEASE.url).toContain(`/v${LINUX_DOSBOX_RELEASE.version}/`);
    expect(LINUX_DOSBOX_RELEASE.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("checksumProblem", () => {
  const bytes = Buffer.from("dosbox");
  const digest = createHash("sha256").update(bytes).digest("hex");

  it("accepts bytes whose SHA-256 matches the pin", () => {
    expect(checksumProblem(bytes, digest)).toBeNull();
  });

  it("names both digests when the bytes do not match", () => {
    const problem = checksumProblem(Buffer.from("tampered"), digest);
    expect(problem).toContain(digest);
    expect(problem).toMatch(/does not match/);
  });
});
