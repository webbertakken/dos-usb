import React from "react";
import { FaPlay } from "react-icons/fa";
import { Welcome, type GiftMessage } from "../domain/firstRun/welcome";

interface WelcomePanelProps {
  gift: GiftMessage | null;
  onDismiss: () => void;
}

const STEPS = [
  "Pick a game from My Games below.",
  "Press its green Play button. The game opens in a new window.",
  "When you are done, close the game window to come back here.",
];

/** The first thing a new owner sees: a warm hello and how to start. */
const WelcomePanel: React.FC<WelcomePanelProps> = ({ gift, onDismiss }) => {
  const signature = Welcome.signature(gift);

  return (
    <section
      aria-labelledby="welcome-heading"
      className="mb-8 rounded-xl bg-gradient-to-br from-indigo-950 via-gray-800 to-purple-950 border border-indigo-700 p-6 md:p-8 shadow-xl"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-4xl mb-2" aria-hidden="true">
            {gift ? "🎂🕹️" : "🕹️"}
          </p>
          <h2 id="welcome-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            {Welcome.greeting(gift)}
          </h2>
          {gift?.message && (
            <blockquote className="text-lg text-gray-100 whitespace-pre-line border-l-4 border-indigo-400 pl-4 mb-3">
              {gift.message}
            </blockquote>
          )}
          {signature && <p className="text-indigo-200 font-semibold text-lg">{signature}</p>}
          {!gift && (
            <p className="text-lg text-gray-200">
              Your classic DOS games are ready to play, straight from this stick.
            </p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Playing takes three steps</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-100 text-lg">
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="self-start inline-flex items-center gap-3 rounded-lg bg-green-700 hover:bg-green-800 px-6 py-3 text-xl font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300"
          >
            <FaPlay aria-hidden="true" />
            Let&apos;s play
          </button>
        </div>
      </div>
    </section>
  );
};

export default WelcomePanel;
