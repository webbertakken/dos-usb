/**
 * Plain-language errors for someone who has never seen a terminal: what
 * happened and what to do, with the original text kept as a detail.
 */

export type FriendlyError = {
  readonly message: string;
  readonly detail: string;
};

const FALLBACK = "Something went wrong. Please try again.";

const EXPLANATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|socket hang up|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|network/i,
    "This needs an internet connection. Check you are connected, then try again. Games already on your stick still work without one.",
  ],
  [
    /DOSBox was not found/i,
    "The game player that runs these games is missing from this stick. Ask the person who gave it to you to set it up again.",
  ],
  [/No suitable executable/i, "We could not start this game. Please pick another one to play."],
  [
    /ENOSPC|no space left/i,
    "Your stick is full. Remove a game you no longer play, then try again.",
  ],
  [
    /EACCES|EPERM|EROFS|read-only/i,
    "Your stick seems locked or read-only. Check the little lock switch on its side, then try again.",
  ],
  [
    /\b40[34]\b|\b5\d\d\b|Not Found/i,
    "This game's download is not available right now. Please try another game, or try again later.",
  ],
  [
    /requires Electron/i,
    "Open the DOS USB app from your stick to play games. This page cannot start them by itself.",
  ],
];

export function friendlyError(raw: unknown): FriendlyError {
  const detail = raw instanceof Error ? raw.message : String(raw ?? "");
  const explanation = EXPLANATIONS.find(([pattern]) => pattern.test(detail));
  return { message: explanation?.[1] ?? FALLBACK, detail };
}
