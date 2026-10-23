import React from "react";
import Link from "next/link";
import PixelArt, { type PixelArtName } from "./PixelArt";
import { buttonClass } from "./buttonStyles";

type EmptyStateAction = { label: string } & ({ onClick: () => void } | { href: string });

interface EmptyStateProps {
  art: PixelArtName;
  title: string;
  text: React.ReactNode;
  action?: EmptyStateAction;
}

/** Nothing to show yet: say why, kindly, and offer one way forward. */
const EmptyState: React.FC<EmptyStateProps> = ({ art, title, text, action }) => (
  <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
    <PixelArt name={art} scale={5} />
    <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-paper">{title}</h2>
    <p className="mt-2 max-w-md text-base leading-relaxed text-muted">{text}</p>
    {action &&
      ("href" in action ? (
        <Link href={action.href} className={`${buttonClass("fetch")} mt-6`}>
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} className={`${buttonClass("fetch")} mt-6`}>
          {action.label}
        </button>
      ))}
  </div>
);

export default EmptyState;
