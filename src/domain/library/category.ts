/**
 * Map each source's raw category/subject onto the unified taxonomy.
 */

import { UnifiedCategory } from "./types";

// Explicit mappings for known source categories (matched case-insensitively).
const EXPLICIT: Record<string, UnifiedCategory> = {
  action: "Action",
  adventure: "Adventure",
  "classic / arcade": "Arcade",
  classic: "Arcade",
  "ball & paddle": "Arcade",
  "driving & racing": "Driving & Racing",
  "educational / kids": "Educational",
  fighting: "Fighting",
  puzzle: "Puzzle",
  "tetris style": "Puzzle",
  "role playing (rpg)": "Role Playing",
  sidescrolling: "Platformer",
  "3d shooting": "Shooter",
  "3d shooting (fps)": "Shooter",
  "shoot-em-up": "Shooter",
  "simulation / strategy": "Strategy",
  "simulation / sports": "Sports",
  simulation: "Simulation",
  sports: "Sports",
  "traditional (board games)": "Board & Card",
  miscellaneous: "Uncategorised",
};

// Keyword heuristics for freeform subjects (checked in order).
const KEYWORDS: [RegExp, UnifiedCategory][] = [
  [/\b(fps|shooter|shoot|shmup)\b/, "Shooter"],
  [/\b(rpg|role[- ]?playing)\b/, "Role Playing"],
  [/\b(racing|driving|racer)\b/, "Driving & Racing"],
  [/\b(platform)/, "Platformer"],
  [/\b(strateg)/, "Strategy"],
  [/\b(adventure|point[- ]and[- ]click)\b/, "Adventure"],
  [/\b(puzzle|tetris)\b/, "Puzzle"],
  [/\b(fighting|beat[- ]?em[- ]?up)\b/, "Fighting"],
  [/\b(sport|soccer|football|basketball|golf|tennis)\b/, "Sports"],
  [/\b(board|cards?|chess|poker)\b/, "Board & Card"],
  [/\b(arcade|classic)\b/, "Arcade"],
  [/\b(education|kids|learning)\b/, "Educational"],
  [/\b(sim|simulation)\b/, "Simulation"],
  [/\b(action)\b/, "Action"],
];

export function unifyCategory(raw: string): UnifiedCategory {
  const text = (raw || "").trim().toLowerCase();
  if (!text) {
    return "Uncategorised";
  }
  if (EXPLICIT[text]) {
    return EXPLICIT[text];
  }
  for (const [pattern, category] of KEYWORDS) {
    if (pattern.test(text)) {
      return category;
    }
  }
  return "Uncategorised";
}
