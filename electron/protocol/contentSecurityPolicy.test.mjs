import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { inlineScriptHashes, buildContentSecurityPolicy } from "./contentSecurityPolicy.mjs";

const sha256 = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

describe("inlineScriptHashes", () => {
  it("hashes the exact text of every inline script", () => {
    const first = "(self.__next_f=self.__next_f||[]).push([0])";
    const second = 'self.__next_f.push([1,"0:{\\"P\\":null}\\n"])';
    const html = `<head><script>${first}</script></head><body><script>${second}</script></body>`;

    expect(inlineScriptHashes(html)).toEqual([sha256(first), sha256(second)]);
  });

  it("hashes inline scripts that carry attributes", () => {
    const html = '<script id="__next-data" type="text/javascript">boot()</script>';

    expect(inlineScriptHashes(html)).toEqual([sha256("boot()")]);
  });

  it("skips external scripts, which 'self' already covers", () => {
    const html =
      '<script src="/_next/static/chunks/main.js" async=""></script><script>inline()</script>';

    expect(inlineScriptHashes(html)).toEqual([sha256("inline()")]);
  });

  it("hashes multi-line scripts byte for byte", () => {
    const body = "\n  first();\n  second();\n";

    expect(inlineScriptHashes(`<script>${body}</script>`)).toEqual([sha256(body)]);
  });

  it("lists each distinct script once", () => {
    expect(inlineScriptHashes("<script>a()</script><script>a()</script>")).toEqual([sha256("a()")]);
  });

  it("returns nothing for a document without inline scripts", () => {
    expect(inlineScriptHashes("<html><body>plain</body></html>")).toEqual([]);
  });
});

const directive = (policy, name) =>
  policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe("buildContentSecurityPolicy", () => {
  it("allows only same-origin scripts plus the given hashes in production", () => {
    const policy = buildContentSecurityPolicy({ isDev: false, scriptHashes: ["'sha256-abc='"] });

    expect(directive(policy, "script-src")).toBe("script-src 'self' 'sha256-abc='");
  });

  it("never allows inline or eval'd scripts in production", () => {
    const policy = buildContentSecurityPolicy({ isDev: false, scriptHashes: [] });

    expect(directive(policy, "script-src")).toBe("script-src 'self'");
  });

  it("allows hotlinked https, cached and same-origin images in production", () => {
    const policy = buildContentSecurityPolicy({ isDev: false, scriptHashes: [] });

    expect(directive(policy, "img-src")).toBe("img-src 'self' data: https: dosusb-image:");
  });

  it("allows cached images in development", () => {
    const policy = buildContentSecurityPolicy({ isDev: true });

    expect(directive(policy, "img-src")).toBe("img-src 'self' data: https: dosusb-image:");
  });

  it("locks down plugins and base-URI hijacking in production", () => {
    const policy = buildContentSecurityPolicy({ isDev: false, scriptHashes: [] });

    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
  });

  it("allows the dev server's inline, eval'd and websocket traffic in development", () => {
    const policy = buildContentSecurityPolicy({ isDev: true });

    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' ws: wss: http: https:");
  });
});
