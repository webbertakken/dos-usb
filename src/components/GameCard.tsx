import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import { FaPlay, FaPen } from "react-icons/fa";
import { Game } from "../types";
import PixelArt from "./PixelArt";
import PixelSpinner from "./PixelSpinner";
import { buttonClass } from "./buttonStyles";

interface GameCardProps {
  game: Game;
  onPlay: (gameId: string) => void;
  onEdit: (game: Game) => void;
  starting?: boolean;
}

/** One game on your shelf: its screen, its name, and a big Play button. */
const GameCard: React.FC<GameCardProps> = ({ game, onPlay, onEdit, starting = false }) => {
  const isCustom = game.source === "custom";
  const needsAttention = game.status === "needs-attention";
  const details = [game.year, game.category].filter(Boolean).join(" · ");

  return (
    <article
      className={`group flex w-full flex-col rounded-2xl border bg-panel p-3 transition-[box-shadow,transform,border-color] motion-safe:hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 ${
        needsAttention ? "border-dashed border-amber/60" : "border-line hover:border-field"
      }`}
    >
      <div className="crt aspect-[16/10] w-full rounded-xl">
        {game.image ? (
          <Image
            src={displayImageUrl(game.image)}
            alt=""
            className="pixelated object-cover"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-raised/40">
            <PixelArt name={needsAttention ? "question" : "joystick"} scale={5} />
          </div>
        )}
        {isCustom && (
          <span className="absolute left-2 top-2 z-10 -rotate-3 rounded-md bg-amber px-2 py-0.5 text-sm font-bold text-ink shadow-md shadow-black/40">
            Your game
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <h3 className="line-clamp-2 min-h-[2lh] font-display text-lg font-bold leading-snug tracking-tight text-paper">
          {game.title}
        </h3>
        {needsAttention ? (
          <p className="mt-2 flex-1 border-l-2 border-amber pl-3 text-sm leading-relaxed text-amber">
            {`Needs attention: ${game.attention ?? "the app could not tell how to start it."}`}
          </p>
        ) : (
          <>
            <p className="mb-3 mt-0.5 flex-1 font-pixel text-lg leading-tight text-muted">
              {details}
            </p>
            <button
              type="button"
              onClick={() => onPlay(game.id)}
              disabled={starting}
              aria-label={`Play ${game.title}`}
              className={`${buttonClass("play", "lg")} w-full font-display font-extrabold tracking-wide`}
            >
              {starting ? (
                <>
                  <PixelSpinner />
                  Starting…
                </>
              ) : (
                <>
                  <FaPlay aria-hidden="true" className="text-base" />
                  Play
                </>
              )}
            </button>
          </>
        )}

        {!isCustom && (
          <button
            type="button"
            onClick={() => onEdit(game)}
            aria-label={`Edit details of ${game.title}`}
            className={`${buttonClass("quiet", "sm")} mt-1 self-center text-faint`}
          >
            <FaPen aria-hidden="true" className="text-xs" />
            Edit details
          </button>
        )}
      </div>
    </article>
  );
};

export default GameCard;
