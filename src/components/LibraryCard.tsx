import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import {
  FaDownload,
  FaWifi,
  FaSpinner,
  FaCheck,
  FaExclamationTriangle,
  FaPlay,
  FaStar,
} from "react-icons/fa";
import { CanonicalGame } from "../domain/library/types";
import { DownloadStatus } from "../types";
import { chooseDownloadSource } from "../domain/library/select";
import { friendlyError } from "../domain/firstRun/friendlyError";

interface LibraryCardProps {
  game: CanonicalGame;
  installed?: boolean;
  downloadStatus?: DownloadStatus;
  onDownload: (game: CanonicalGame) => void;
  /** Downloads need the internet; offline they say so instead of failing. */
  online?: boolean;
  onPlay: (gameId: string) => void;
  onOpen: (game: CanonicalGame) => void;
}

const formatDownloads = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : `${n}`;

const LibraryCard: React.FC<LibraryCardProps> = ({
  game,
  installed = false,
  downloadStatus,
  onDownload,
  onPlay,
  onOpen,
  online = true,
}) => {
  const isDownloading = downloadStatus?.status === "downloading";
  const isExtracting = downloadStatus?.status === "extracting";
  const hasError = downloadStatus?.status === "error";
  const isProcessing = isDownloading || isExtracting;
  const isInstalled = installed || downloadStatus?.status === "completed";
  const downloadable = chooseDownloadSource(game) !== null;
  const needsInternet = downloadable && !online && !isProcessing;

  const maxDownloads = game.sources.reduce((max, s) => Math.max(max, s.metrics.downloads ?? 0), 0);
  const siteCount = new Set(game.sources.map((s) => s.site)).size;

  const actionLabel = () => {
    if (isDownloading) return `Downloading ${downloadStatus?.progress ?? 0}%`;
    if (isExtracting) return "Extracting...";
    if (needsInternet) return "Needs internet";
    if (hasError) return "Retry";
    return "Download";
  };

  return (
    <div className="flex flex-col bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 focus-within:ring-2 focus-within:ring-blue-400">
      <button
        type="button"
        onClick={() => onOpen(game)}
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
              sizes="(max-width: 768px) 100vw, 25vw"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-400">
              No image
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
          {maxDownloads > 0 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-gray-200 text-xs px-2 py-0.5 rounded">
              {formatDownloads(maxDownloads)} downloads
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{game.title}</h3>
            {typeof game.rating === "number" && (
              <span
                className="flex items-center text-yellow-400 text-sm shrink-0"
                aria-hidden="true"
              >
                <FaStar className="mr-1" />
                {game.rating}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs mb-2">
            {[game.year, game.category, game.publisher].filter(Boolean).join("  •  ")}
          </p>
          {game.description && (
            <p className="text-gray-300 text-sm line-clamp-2">{game.description}</p>
          )}
        </div>
      </button>

      <div className="mt-auto p-4 pt-0">
        {isDownloading && downloadStatus?.progress !== undefined && (
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2" aria-hidden="true">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${downloadStatus.progress}%` }}
            ></div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <button
              onClick={() => onPlay(game.id)}
              aria-label={`Play ${game.title}`}
              className="flex-1 flex items-center justify-center bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              <FaPlay className="mr-2" aria-hidden="true" /> Play
            </button>
          ) : (
            <button
              onClick={() => !isProcessing && downloadable && online && onDownload(game)}
              disabled={isProcessing || !downloadable || needsInternet}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                needsInternet
                  ? "bg-gray-700 text-gray-200 cursor-not-allowed"
                  : hasError
                    ? "bg-red-700 hover:bg-red-800"
                    : !downloadable
                      ? "bg-gray-700 cursor-not-allowed"
                      : isProcessing
                        ? "bg-gray-600 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isProcessing ? (
                <FaSpinner className="mr-2 animate-spin" aria-hidden="true" />
              ) : needsInternet ? (
                <FaWifi className="mr-2" aria-hidden="true" />
              ) : hasError ? (
                <FaExclamationTriangle className="mr-2" aria-hidden="true" />
              ) : (
                <FaDownload className="mr-2" aria-hidden="true" />
              )}
              {downloadable ? actionLabel() : "Play online"}
            </button>
          )}
          <span className="text-gray-400 text-xs whitespace-nowrap" title="Number of sources">
            {siteCount} {siteCount === 1 ? "source" : "sources"}
          </span>
        </div>
        {hasError && downloadStatus?.error && (
          <p className="text-red-300 text-sm mt-2">{friendlyError(downloadStatus.error).message}</p>
        )}
      </div>
    </div>
  );
};

export default LibraryCard;
