import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import { FaPlay, FaEdit, FaSpinner, FaExclamationTriangle } from "react-icons/fa";
import { Game } from "../types";

interface GameCardProps {
  game: Game;
  onPlay: (gameId: string) => void;
  onEdit: (game: Game) => void;
  starting?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({ game, onPlay, onEdit, starting = false }) => {
  const isCustom = game.source === "custom";
  const needsAttention = game.status === "needs-attention";
  const details = [game.year, game.category].filter(Boolean).join(" • ");

  return (
    <div className="w-full flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
      <div className="relative h-44 w-full bg-gray-700">
        {game.image ? (
          <Image
            src={displayImageUrl(game.image)}
            alt=""
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-5xl"
            aria-hidden="true"
          >
            🕹️
          </div>
        )}
        {isCustom && (
          <span className="absolute top-2 left-2 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-gray-900">
            Your game
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-xl font-bold text-white mb-1">{game.title}</h3>
        {needsAttention ? (
          <p role="status" className="flex gap-2 text-amber-200 text-sm mb-4 flex-1">
            <FaExclamationTriangle aria-hidden className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Needs attention: </span>
              {game.attention}
            </span>
          </p>
        ) : (
          <>
            {details && <p className="text-gray-300 text-sm mb-2">{details}</p>}
            <p className="text-gray-300 text-sm mb-4 line-clamp-2 flex-1">{game.description}</p>
          </>
        )}

        <button
          type="button"
          onClick={() => onPlay(game.id)}
          disabled={starting || needsAttention}
          aria-label={`Play ${game.title}`}
          className="w-full flex items-center justify-center gap-3 rounded-lg bg-green-700 hover:bg-green-800 disabled:cursor-wait disabled:bg-green-900 px-4 py-3 text-xl font-bold text-white transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 data-[attention=true]:bg-gray-600 data-[attention=true]:text-gray-200 data-[attention=true]:cursor-not-allowed"
          data-attention={needsAttention}
        >
          {starting ? (
            <>
              <FaSpinner className="animate-spin" aria-hidden="true" />
              Starting…
            </>
          ) : (
            <>
              <FaPlay aria-hidden="true" />
              Play
            </>
          )}
        </button>

        {!isCustom && (
          <button
            type="button"
            onClick={() => onEdit(game)}
            aria-label={`Edit details of ${game.title}`}
            className="mt-2 self-end inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <FaEdit aria-hidden="true" />
            Edit details
          </button>
        )}
      </div>
    </div>
  );
};

export default GameCard;
