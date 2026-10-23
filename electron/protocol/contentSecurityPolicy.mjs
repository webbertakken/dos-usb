/**
 * Content Security Policy for the renderer.
 *
 * A Next.js static export streams its React Server Component payload through
 * inline `<script>` tags. Rather than allowing every inline script
 * ('unsafe-inline'), production documents allow exactly the inline scripts
 * they ship, by hash. The export is static, so the hashes are stable.
 */

import { createHash } from "crypto";

// An inline script is a <script> without a src attribute; its text is hashed
// byte for byte, exactly as the browser does when checking 'sha256-...'.
const INLINE_SCRIPT = /<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

const sha256Source = (text) =>
  `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** CSP hash sources for every distinct inline script in an HTML document. */
export function inlineScriptHashes(html) {
  const scripts = [...html.matchAll(INLINE_SCRIPT)].map(([, body]) => body);
  return [...new Set(scripts.map(sha256Source))];
}

const DEVELOPMENT_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' ws: wss: http: https:",
];

/**
 * The policy for a renderer document.
 * Development trusts the Next dev server (HMR needs inline, eval and sockets);
 * production trusts only the app's own origin plus the document's script hashes.
 */
export function buildContentSecurityPolicy({ isDev, scriptHashes = [] }) {
  if (isDev) return DEVELOPMENT_POLICY.join("; ");

  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
