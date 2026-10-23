import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import {
  FaDownload,
  FaSpinner,
  FaCheck,
  FaExclamationTriangle,
  FaPlay,
  FaStar,
} from "react-icons/fa";
import { DosgamesListItem, DownloadStatus } from "../types";

interface StoreGameCardProps {
  game: DosgamesListItem;
  onDownload: (game: DosgamesListItem) => void;
  onPlay?: (gameId: string) => void;
  onOpen?: (game: DosgamesListItem) => void;
  downloadStatus?: DownloadStatus;
  installed?: boolean;
}

const StoreGameCard: React.FC<StoreGameCardProps> = ({
  game,
  onDownload,
  onPlay,
  onOpen,
  downloadStatus,
  installed = false,
}) => {
  const isDownloading = downloadStatus?.status === "downloading";
  const isExtracting = downloadStatus?.status === "extracting";
  const justCompleted = downloadStatus?.status === "completed";
  const hasError = downloadStatus?.status === "error";
  const isProcessing = isDownloading || isExtracting;
  const isInstalled = installed || justCompleted;

  const renderDownloadLabel = () => {
    if (isDownloading) {
      return (
        <>
          <FaSpinner className="mr-2 animate-spin" aria-hidden="true" />
          Downloading {downloadStatus?.progress ?? 0}%
        </>
      );
    }
    if (isExtracting) {
      return (
        <>
          <FaSpinner className="mr-2 animate-spin" aria-hidden="true" />
          Extracting...
        </>
      );
    }
    if (hasError) {
      return (
        <>
          <FaExclamationTriangle className="mr-2" aria-hidden="true" />
          Retry download
        </>
      );
    }
    return (
      <>
        <FaDownload className="mr-2" aria-hidden="true" />
        Download{game.fileSize ? ` (${game.fileSize})` : ""}
      </>
    );
  };

  return (
    <div className="flex flex-col bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 focus-within:ring-2 focus-within:ring-blue-400">
      <button
        type="button"
        onClick={() => onOpen?.(game)}
        aria-label={`View details for ${game.title}`}
        className="text-left focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <div className="relative h-40 w-full bg-gray-900">
          {game.image ? (
            <Image
              src={displayImageUrl(game.image)}
              alt={`${game.title} screenshot`}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-700">
              <span className="text-2xl text-gray-400">No Image</span>
            </div>
          )}

          {game.mature && (
            <span className="absolute top-2 right-2 bg-red-700 text-white text-xs font-bold px-2 py-1 rounded">
              18+
            </span>
          )}
          {isInstalled && (
            <span className="absolute top-2 left-2 bg-green-700 text-white text-xs font-bold px-2 py-1 rounded inline-flex items-center">
              <FaCheck className="mr-1" aria-hidden="true" /> Installed
            </span>
          )}
        </div>

        <div className="p-4 flex-grow">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-white mb-1">{game.title}</h3>
            {typeof game.dgRating === "number" && (
              <span
                className="flex items-center text-yellow-400 text-sm shrink-0"
                title={`DOSGames rating: ${game.dgRating}/5`}
                aria-label={`Rated ${game.dgRating} out of 5`}
              >
                <FaStar className="mr-1" aria-hidden="true" />
                {game.dgRating}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">
            {[game.year, game.category, game.publisher].filter(Boolean).join(" • ")}
          </p>
          <p className="text-gray-300 text-sm mb-2 line-clamp-3">{game.description}</p>
        </div>
      </button>

      <div className="p-4 pt-0">
        {isDownloading && downloadStatus?.progress !== undefined && (
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2" aria-hidden="true">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-[width]"
              style={{ width: `${downloadStatus.progress}%` }}
            ></div>
          </div>
        )}

        {isInstalled && onPlay ? (
          <button
            onClick={() => onPlay(game.id)}
            className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 text-white px-4 py-2 rounded-md transition-colors"
          >
            <FaPlay className="mr-2" aria-hidden="true" />
            Play
          </button>
        ) : (
          <button
            onClick={() => !isProcessing && onDownload(game)}
            disabled={isProcessing}
            className={`w-full flex items-center justify-center text-white px-4 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
              hasError
                ? "bg-red-600 hover:bg-red-700"
                : isProcessing
                  ? "bg-gray-600 cursor-wait"
                  : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {renderDownloadLabel()}
          </button>
        )}

        {hasError && downloadStatus?.error && (
          <p className="text-red-400 text-xs mt-2">{downloadStatus.error}</p>
        )}
      </div>
    </div>
  );
};

export default StoreGameCard;
