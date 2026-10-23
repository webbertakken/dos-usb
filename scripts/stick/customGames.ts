/**
 * `games-custom/` beside the app holds games the recipient owns and adds
 * themselves. A stick ships it empty but for a note; refreshing a stick never
 * deletes or replaces anything in it.
 */

export const CUSTOM_GAMES_DIR = "games-custom";

const lines = [
  "Put your own DOS games in this folder.",
  "",
  "1. Copy each game you own into a folder of its own in here,",
  "   for example: games-custom\\Monkey Island\\",
  "2. Open the DOS games app again. Your games appear with the others.",
  "",
  "Everything in this folder is yours: updating the stick never changes it.",
];

/** The note in an empty `games-custom/`, with Windows line endings for Notepad. */
export const CUSTOM_GAMES_NOTE = {
  name: "PUT YOUR OWN GAMES HERE.txt",
  text: `${lines.join("\r\n")}\r\n`,
} as const;
