import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import { FaPlay, FaEdit, FaExclamationTriangle } from "react-icons/fa";
import { Game } from "../types";

interface GameCardProps {
  game: Game;
  onPlay: (gameId: string) => void;
  onEdit: (game: Game) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, onPlay, onEdit }) => {
  const isCustom = game.source === "custom";
  const needsAttention = game.status === "needs-attention";
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">
      <div className="relative h-40 w-full">
        {game.image ? (
          <Image
            src={displayImageUrl(game.image)}
            alt={game.title}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700">
            <span className="text-2xl text-gray-400">No Image</span>
          </div>
        )}
        {isCustom && (
          <span className="absolute top-2 left-2 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-gray-900">
            Your game
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-1">{game.title}</h3>
        {needsAttention ? (
          <p role="status" className="flex gap-2 text-amber-200 text-sm mb-4">
            <FaExclamationTriangle aria-hidden className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Needs attention: </span>
              {game.attention}
            </span>
          </p>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-2">
              {[game.year, game.category].filter(Boolean).join(" • ")}
            </p>
            <p className="text-gray-300 text-sm mb-4 line-clamp-2">{game.description}</p>
          </>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => onPlay(game.id)}
            disabled={needsAttention}
            className="flex items-center justify-center bg-green-700 hover:bg-green-800 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
          >
            <FaPlay className="mr-2" />
            Play
          </button>

          {!isCustom && (
            <button
              onClick={() => onEdit(game)}
              className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              <FaEdit className="mr-2" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCard;
