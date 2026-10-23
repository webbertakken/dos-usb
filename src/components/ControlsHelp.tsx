import React from "react";

const Keys: React.FC<{ keys: ReadonlyArray<string> }> = ({ keys }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    {keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && (
          <span aria-hidden="true" className="font-pixel text-xl text-faint">
            +
          </span>
        )}
        <kbd className="inline-flex min-w-11 items-center justify-center rounded-md border border-field bg-raised px-2 pb-0.5 text-xl leading-7 text-paper shadow-[inset_0_-3px_0_rgb(0_0_0/0.35)]">
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
    className="rounded-2xl border border-line bg-panel/60 p-6 sm:p-8"
  >
    <h2
      id="controls-help-heading"
      className="font-display text-xl font-bold tracking-tight text-paper"
    >
      Game controls
    </h2>
    <p className="mt-1 text-muted">
      Games open in their own window. These keys work in every game:
    </p>
    <dl className="mt-6 grid gap-6 md:grid-cols-3">
      {CONTROLS.map(({ keys, does }) => (
        <div key={keys.join("+")} className="flex flex-col gap-3">
          <dt>
            <Keys keys={keys} />
          </dt>
          <dd className="text-sm leading-relaxed text-muted">{does}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export default ControlsHelp;
