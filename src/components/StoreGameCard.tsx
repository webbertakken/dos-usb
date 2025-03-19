import React from 'react';
import Image from 'next/image';
import { FaDownload, FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { DosgamesListItem, DownloadStatus } from '../types';

interface StoreGameCardProps {
  game: DosgamesListItem;
  onDownload: (game: DosgamesListItem) => void;
  downloadStatus?: DownloadStatus;
}

const StoreGameCard: React.FC<StoreGameCardProps> = ({
  game,
  onDownload,
  downloadStatus
}) => {
  const isDownloading = downloadStatus?.status === 'downloading';
  const isExtracting = downloadStatus?.status === 'extracting';
  const isCompleted = downloadStatus?.status === 'completed';
  const hasError = downloadStatus?.status === 'error';
  const isProcessing = isDownloading || isExtracting;

  // Determine the button state
  const getButtonContent = () => {
    if (isDownloading) {
      return (
        <>
          <FaSpinner className="mr-2 animate-spin" />
          Downloading {downloadStatus.progress}%
        </>
      );
    } else if (isExtracting) {
      return (
        <>
          <FaSpinner className="mr-2 animate-spin" />
          Extracting...
        </>
      );
    } else if (isCompleted) {
      return (
        <>
          <FaCheck className="mr-2" />
          Installed
        </>
      );
    } else if (hasError) {
      return (
        <>
          <FaExclamationTriangle className="mr-2" />
          Failed
        </>
      );
    } else {
      return (
        <>
          <FaDownload className="mr-2" />
          Download
        </>
      );
    }
  };

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
            unoptimized
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
        {isDownloading && downloadStatus?.progress !== undefined && (
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${downloadStatus.progress}%` }}
            ></div>
          </div>
        )}

        <button
          onClick={() => !isProcessing && !isCompleted && onDownload(game)}
          disabled={isProcessing || isCompleted}
          className={`w-full flex items-center justify-center ${
            isCompleted
              ? 'bg-green-600 cursor-default'
              : hasError
                ? 'bg-red-600 hover:bg-red-700'
                : isProcessing
                  ? 'bg-gray-600 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-4 py-2 rounded-md transition-colors`}
        >
          {getButtonContent()}
        </button>

        {hasError && downloadStatus?.error && (
          <p className="text-red-400 text-xs mt-2">{downloadStatus.error}</p>
        )}
      </div>
    </div>
  );
};

export default StoreGameCard;
