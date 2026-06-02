"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import {
  FaDownload,
  FaPlay,
  FaSpinner,
  FaCheck,
  FaStar,
  FaTimes,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { DosgamesListItem, DownloadStatus } from "../types";

interface GameDetailModalProps {
  game: DosgamesListItem;
  installed: boolean;
  downloadStatus?: DownloadStatus;
  onDownload: (game: DosgamesListItem) => void;
  onPlay: (gameId: string) => void;
  onClose: () => void;
}

const Fact: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value ? (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-200">{value}</dd>
    </div>
  ) : null;

const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  installed,
  downloadStatus,
  onDownload,
  onPlay,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const isDownloading = downloadStatus?.status === "downloading";
  const isExtracting = downloadStatus?.status === "extracting";
  const isProcessing = isDownloading || isExtracting;
  const isInstalled = installed || downloadStatus?.status === "completed";

  // Focus management, ESC to close, body scroll lock, focus restore.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const meta = [game.year, game.category, game.publisher].filter(Boolean).join("  •  ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Full-screen backdrop button closes on click; ESC also closes. */}
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-detail-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-xl shadow-2xl border border-gray-700"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <FaTimes aria-hidden="true" />
        </button>

        {/* Hero image */}
        <div className="relative w-full h-56 sm:h-72 bg-gray-950">
          {game.image ? (
            <Image
              src={game.image}
              alt={`${game.title} screenshot`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-500">
              No screenshot
            </div>
          )}
          {game.mature && (
            <span className="absolute top-3 left-3 bg-red-700 text-white text-xs font-bold px-2 py-1 rounded">
              18+ Mature
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="game-detail-title" className="text-2xl font-bold text-white">
                {game.title}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{meta}</p>
            </div>
            {typeof game.dgRating === "number" && (
              <span
                className="flex items-center text-yellow-400 text-lg shrink-0"
                aria-label={`Rated ${game.dgRating} out of 5`}
              >
                <FaStar className="mr-1" aria-hidden="true" />
                {game.dgRating}
                <span className="text-gray-500 text-sm ml-1">/ 5</span>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-4">
            {isInstalled ? (
              <button
                onClick={() => onPlay(game.id)}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <FaPlay className="mr-2" aria-hidden="true" /> Play
              </button>
            ) : (
              <button
                onClick={() => !isProcessing && onDownload(game)}
                disabled={isProcessing}
                className="flex items-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-5 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {isProcessing ? (
                  <FaSpinner className="mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <FaDownload className="mr-2" aria-hidden="true" />
                )}
                {isDownloading
                  ? `Downloading ${downloadStatus?.progress ?? 0}%`
                  : isExtracting
                    ? "Extracting..."
                    : `Download${game.fileSize ? ` (${game.fileSize})` : ""}`}
              </button>
            )}
            {isInstalled && (
              <span className="flex items-center text-green-400 text-sm">
                <FaCheck className="mr-1" aria-hidden="true" /> Installed
              </span>
            )}
          </div>

          {/* Description */}
          {game.description && (
            <p className="text-gray-300 text-sm leading-relaxed mt-5 whitespace-pre-line">
              {game.description}
            </p>
          )}

          {/* Facts */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            <Fact label="Year" value={game.year} />
            <Fact label="Category" value={game.category} />
            <Fact label="Publisher" value={game.publisher} />
            <Fact label="Licence" value={game.license} />
            <Fact label="Resolution" value={game.resolution} />
            <Fact label="Multiplayer" value={game.multiplayer} />
            <Fact label="File size" value={game.fileSize} />
            <Fact label="Runs" value={game.runExe} />
          </dl>

          {/* Tags */}
          {game.tags && game.tags.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External links */}
          {game.links && game.links.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">More info</h3>
              <div className="flex flex-wrap gap-2">
                {game.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center bg-gray-800 hover:bg-gray-700 text-blue-300 text-sm px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {link.label}
                    <FaExternalLinkAlt className="ml-2 text-xs" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Provenance / credits */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Listed on</h3>
            <a
              href={`https://www.dosgames.com/game/${game.slug ?? game.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-300 hover:text-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
            >
              dosgames.com
              <FaExternalLinkAlt className="ml-2 text-xs" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDetailModal;
