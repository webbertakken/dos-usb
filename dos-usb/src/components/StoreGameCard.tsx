import React from 'react';
import Image from 'next/image';
import { FaDownload } from 'react-icons/fa';
import { DosgamesListItem } from '../types';

interface StoreGameCardProps {
  game: DosgamesListItem;
  onDownload: (game: DosgamesListItem) => void;
  isDownloading: boolean;
}

const StoreGameCard: React.FC<StoreGameCardProps> = ({
  game,
  onDownload,
  isDownloading
}) => {
  return (
    <div className="flex flex-col bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">
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

      <div className="p-4 flex-grow">
        <h3 className="text-xl font-bold text-white mb-1">{game.title}</h3>
        <p className="text-gray-400 text-sm mb-2">{game.year} • {game.category}</p>
        <p className="text-gray-300 text-sm mb-4 line-clamp-3">{game.description}</p>
      </div>

      <div className="p-4 pt-0">
        <button
          onClick={() => onDownload(game)}
          disabled={isDownloading}
          className={`w-full flex items-center justify-center ${
            isDownloading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-4 py-2 rounded-md transition-colors`}
        >
          <FaDownload className="mr-2" />
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    </div>
  );
};

export default StoreGameCard;
