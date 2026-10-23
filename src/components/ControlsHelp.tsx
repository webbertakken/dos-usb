import React from "react";

const Keys: React.FC<{ keys: ReadonlyArray<string> }> = ({ keys }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    {keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && <span>+</span>}
        <kbd className="px-2 py-1 rounded-md bg-gray-700 border border-gray-500 text-white font-mono text-sm">
          {key}
        </kbd>
      </React.Fragment>
    ))}
  </span>
);

const CONTROLS: ReadonlyArray<{ keys: ReadonlyArray<string>; does: string }> = [
  { keys: ["Alt", "Enter"], does: "Switch full screen on or off." },
  {
    keys: ["Ctrl", "F10"],
    does: "Free your mouse pointer when the game has caught it. Click in the game to catch it again.",
  },
  {
    keys: ["Ctrl", "F9"],
    does: "Close the game straight away. Most games also quit from their own menu, often with Esc.",
  },
];

/** The few keys a newcomer needs while a game is running. */
const ControlsHelp: React.FC = () => (
  <section
    aria-labelledby="controls-help-heading"
    className="rounded-lg bg-gray-800 border border-gray-700 p-5"
  >
    <h2 id="controls-help-heading" className="text-xl font-bold text-white mb-1">
      Game controls
    </h2>
    <p className="text-gray-300 mb-4">
      Games open in their own window. These keys work in every game:
    </p>
    <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
      {CONTROLS.map(({ keys, does }) => (
        <React.Fragment key={keys.join("+")}>
          <dt>
            <Keys keys={keys} />
          </dt>
          <dd className="text-gray-200 mb-2 sm:mb-0">{does}</dd>
        </React.Fragment>
      ))}
    </dl>
  </section>
);

export default ControlsHelp;
