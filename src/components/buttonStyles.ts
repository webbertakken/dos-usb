/**
 * The app's button vocabulary. Each colour has one job: phosphor plays,
 * cyan fetches and navigates, rose celebrates, amber warns; quiet is for
 * everything secondary.
 */

export type ButtonTone = "play" | "fetch" | "gift" | "warn" | "quiet" | "idle";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,color,box-shadow,transform] select-none disabled:cursor-not-allowed motion-safe:active:translate-y-px";

const TONES: Record<ButtonTone, string> = {
  play: "bg-phosphor text-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] hover:bg-phosphor-bright disabled:cursor-wait",
  fetch: "bg-cyan/12 text-cyan ring-1 ring-cyan/60 hover:bg-cyan/20",
  gift: "text-rose ring-1 ring-rose/60 hover:bg-rose/10",
  warn: "bg-amber/12 text-amber ring-1 ring-amber/60 hover:bg-amber/20",
  quiet: "text-muted hover:bg-raised hover:text-paper",
  idle: "bg-raised text-muted ring-1 ring-line",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-13 px-6 text-lg",
};

export const buttonClass = (tone: ButtonTone, size: ButtonSize = "md"): string =>
  `${BASE} ${TONES[tone]} ${SIZES[size]}`;
