/**
 * Minimal robots.txt parsing - enough to honour Disallow rules politely.
 */

export interface RobotsRules {
  disallow: string[];
}

/**
 * Parse a robots.txt into the Disallow rules that apply to `userAgent`,
 * combining the wildcard group and any group naming the agent.
 */
export function parseRobots(text: string, userAgent: string): RobotsRules {
  const disallow: string[] = [];
  const agentLower = userAgent.toLowerCase();
  let applies = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      applies = value === "*" || agentLower.includes(value.toLowerCase());
    } else if (field === "disallow" && applies && value) {
      disallow.push(value);
    }
  }
  return { disallow };
}

/** True if `path` is permitted by the rules (no matching Disallow prefix). */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  return !rules.disallow.some((prefix) => path.startsWith(prefix));
}
