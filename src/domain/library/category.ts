/**
 * Map each source's raw category/subject onto the unified taxonomy, and infer
 * a category from free text when no source names one.
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
  traditional: "Board & Card",
  miscellaneous: "Uncategorised",
};

// Keyword heuristics for freeform subjects (checked in order).
const KEYWORDS: [RegExp, UnifiedCategory][] = [
  [/\b(fps|shooter|shoot\w*|shmup)\b/, "Shooter"],
  [/\b(rpg|role[- ]?playing)\b/, "Role Playing"],
  [/\b(racing|driving|racer)\b/, "Driving & Racing"],
  [/\b(platform)/, "Platformer"],
  [/\b(strateg)/, "Strategy"],
  [
    /\b(adventure|point[- ]and[- ]click|agi|agt|sci games|interactive fiction|text adventure)\b/,
    "Adventure",
  ],
  [/\b(puzzle|tetris)\b/, "Puzzle"],
  [/\b(fighting|beat[- ]?em[- ]?up)\b/, "Fighting"],
  [/\b(sport|soccer|football|basketball|golf|tennis)\b/, "Sports"],
  [/\b(board|cards?|chess|poker|monopoly|mahjong|solitaire|checkers|backgammon)\b/, "Board & Card"],
  [/\b(arcade|classic|pinball)\b/, "Arcade"],
  [
    /\b(educat\w*|edutainment|kids|learning|reader rabbit|super solvers|living books)\b/,
    "Educational",
  ],
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

// Genre phrases for prose. Only phrases that name a genre count: bare words
// such as "platform" or "action" are catalogue boilerplate in descriptions.
const GENRE_PHRASES: [RegExp, UnifiedCategory][] = [
  [/\b(first[- ]person shooter|fps|shoot[- ]?'?em[- ]?up|shmup|shooter)\b/g, "Shooter"],
  [/\b(role[- ]playing|rpg|dungeon crawlers?)\b/g, "Role Playing"],
  [/\b(racing game|racing|racer|driving game)\b/g, "Driving & Racing"],
  [/\b(platformer|platform game)\b/g, "Platformer"],
  [
    /\b(real[- ]time strategy|turn[- ]based strategy|strategy game|wargame|war game)\b/g,
    "Strategy",
  ],
  [
    /\b(adventure game|point[- ]and[- ]click|text adventure|graphic adventure|interactive fiction)\b/g,
    "Adventure",
  ],
  [/\b(puzzle game|puzzler|puzzle)\b/g, "Puzzle"],
  [/\b(fighting game|beat[- ]?'?em[- ]?up)\b/g, "Fighting"],
  [/\b(sports game|soccer|football|basketball|golf|tennis|hockey|baseball|boxing)\b/g, "Sports"],
  [/\b(board game|card game|chess|solitaire|poker|mahjong|checkers)\b/g, "Board & Card"],
  [/\b(arcade game|arcade|pinball)\b/g, "Arcade"],
  [/\b(educational|edutainment|teaches|learning game)\b/g, "Educational"],
  [/\b(flight simulator|simulator|simulation)\b/g, "Simulation"],
  [/\b(action game)\b/g, "Action"],
];

/** The genre a description names most often; ties go to the earlier rule. */
export function categoryFromDescription(description: string): UnifiedCategory {
  const text = (description || "").toLowerCase();
  let best: UnifiedCategory = "Uncategorised";
  let bestCount = 0;
  for (const [pattern, category] of GENRE_PHRASES) {
    const count = text.match(pattern)?.length ?? 0;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}
