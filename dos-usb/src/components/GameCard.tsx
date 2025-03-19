import React from 'react';
import Image from 'next/image';
import { FaPlay, FaEdit } from 'react-icons/fa';
import { Game } from '../types';

interface GameCardProps {
  game: Game;
  onPlay: (gameId: string) => void;
  onEdit: (game: Game) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, onPlay, onEdit }) => {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">
      <div className="relative h-40 w-full">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
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
      </div>

      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-1">{game.title}</h3>
        <p className="text-gray-400 text-sm mb-2">{game.year} • {game.category}</p>
        <p className="text-gray-300 text-sm mb-4 line-clamp-2">{game.description}</p>

        <div className="flex justify-between">
          <button
            onClick={() => onPlay(game.id)}
            className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <FaPlay className="mr-2" />
            Play
          </button>

          <button
            onClick={() => onEdit(game)}
            className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <FaEdit className="mr-2" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
