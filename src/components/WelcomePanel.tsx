import React from "react";
import { FaPlay } from "react-icons/fa";
import { Welcome, type GiftMessage } from "../domain/firstRun/welcome";
import PixelArt from "./PixelArt";
import { buttonClass } from "./buttonStyles";

interface WelcomePanelProps {
  gift: GiftMessage | null;
  onDismiss: () => void;
}

const STEPS = [
  "Pick a game from My Games below.",
  "Press its Play button. The game opens in its own window.",
  "When you are done, close the game window to come back here.",
];

/** The first thing a new owner sees: a warm hello and how to start. */
const WelcomePanel: React.FC<WelcomePanelProps> = ({ gift, onDismiss }) => {
  const signature = Welcome.signature(gift);

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative mb-8 overflow-hidden rounded-3xl border border-line bg-panel motion-safe:animate-rise"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_0%,rgb(255_148_189/0.16),transparent_70%),radial-gradient(50%_70%_at_100%_100%,rgb(255_203_107/0.12),transparent_70%)]"
      />

      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <div className="flex items-center gap-4">
            <PixelArt name={gift ? "cake" : "joystick"} scale={3} className="shrink-0" />
            <div>
              <p className="font-pixel text-xl leading-none text-rose">
                {gift ? "A present, just for you" : "Plug in, pick, play"}
              </p>
              <h2
                id="welcome-heading"
                className="mt-1 font-display text-3xl font-extrabold leading-tight tracking-tight text-paper sm:text-4xl"
              >
                {Welcome.greeting(gift)}
              </h2>
            </div>
          </div>

          {gift?.message || signature ? (
            <figure className="relative mt-5 rounded-lg bg-paper px-5 pb-3 pt-4 text-ink shadow-lg shadow-black/40 -rotate-[0.6deg]">
              <span
                aria-hidden="true"
                className="absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 rotate-2 bg-rose/70"
              />
              {gift?.message && (
                <blockquote className="whitespace-pre-line text-lg leading-snug">
                  {gift.message}
                </blockquote>
              )}
              {signature && (
                <figcaption className="mt-2 font-display text-lg font-bold text-[#7a2d4c]">
                  {signature}
                </figcaption>
              )}
            </figure>
          ) : (
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted">
              Your classic DOS games are ready to play, straight from this stick.
            </p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-paper">Playing takes three steps</h3>
            <ol className="mt-3 space-y-2">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-base leading-snug text-paper">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised font-pixel text-xl text-phosphor ring-1 ring-line"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className={`${buttonClass("play", "lg")} self-start font-display font-extrabold`}
          >
            <FaPlay aria-hidden="true" className="text-base" />
            Let&apos;s play
          </button>
        </div>
      </div>
    </section>
  );
};

export default WelcomePanel;
