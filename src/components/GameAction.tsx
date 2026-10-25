import React from "react";
import { FaDownload, FaPlay, FaRedo, FaWifi } from "react-icons/fa";
import { CanonicalGame } from "../domain/library/types";
import { DownloadStatus } from "../types";
import { chooseDownloadSource } from "../domain/library/select";
import PixelSpinner from "./PixelSpinner";
import { buttonClass } from "./buttonStyles";

interface GameActionProps {
  game: CanonicalGame;
  installed: boolean;
  downloadStatus?: DownloadStatus;
  online: boolean;
  onDownload: (game: CanonicalGame) => void;
  onPlay: (gameId: string) => void;
  /** Name the download's size on the button, where there is room. */
  showSize?: boolean;
}

/**
 * The one thing to do with a Library game right now: play it, fetch it,
 * watch it arrive, or learn why it cannot be fetched.
 */
const GameAction: React.FC<GameActionProps> = ({
  game,
  installed,
  downloadStatus,
  online,
  onDownload,
  onPlay,
  showSize = false,
}) => {
  const status = downloadStatus?.status;
  const downloadSource = chooseDownloadSource(game);
  const wide = "w-full font-display font-bold";

  if (installed) {
    return (
      <button
        type="button"
        onClick={() => onPlay(game.id)}
        aria-label={`Play ${game.title}`}
        className={`${buttonClass("play", "lg")} ${wide} font-extrabold`}
      >
        <FaPlay aria-hidden="true" className="text-base" />
        Play
      </button>
    );
  }

  if (status === "downloading" || status === "extracting") {
    const progress = status === "downloading" ? (downloadStatus?.progress ?? 0) : undefined;
    return (
      <div className="relative h-13 w-full overflow-hidden rounded-xl bg-raised ring-1 ring-cyan/40">
        <progress
          aria-label={`Downloading ${game.title}`}
          max={100}
          value={progress}
          className="absolute inset-0 h-full w-full appearance-none bg-transparent indeterminate:bg-[repeating-linear-gradient(90deg,rgb(127_214_236/0.32)_0_10px,rgb(127_214_236/0.18)_10px_12px)] [&::-moz-progress-bar]:bg-[repeating-linear-gradient(90deg,rgb(127_214_236/0.32)_0_10px,rgb(127_214_236/0.18)_10px_12px)] [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-[repeating-linear-gradient(90deg,rgb(127_214_236/0.32)_0_10px,rgb(127_214_236/0.18)_10px_12px)] [&::-webkit-progress-value]:bg-transparent [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-500"
        />
        <span
          aria-hidden="true"
          className="relative flex h-full items-center justify-center gap-3 font-display font-bold text-cyan"
        >
          <PixelSpinner />
          {progress === undefined ? "Unpacking…" : `Downloading ${progress}%`}
        </span>
      </div>
    );
  }

  if (!downloadSource) {
    return (
      <button type="button" disabled className={`${buttonClass("idle", "lg")} ${wide}`}>
        No download
      </button>
    );
  }

  if (!online) {
    return (
      <button type="button" disabled className={`${buttonClass("idle", "lg")} ${wide}`}>
        <FaWifi aria-hidden="true" />
        Needs internet
      </button>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={() => onDownload(game)}
        aria-label={`Retry ${game.title}`}
        className={`${buttonClass("warn", "lg")} ${wide}`}
      >
        <FaRedo aria-hidden="true" className="text-sm" />
        Retry
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onDownload(game)}
      aria-label={`Download ${game.title}`}
      className={`${buttonClass("fetch", "lg")} ${wide}`}
    >
      <FaDownload aria-hidden="true" className="text-sm" />
      Download
      {showSize && downloadSource.fileSize && (
        <span className="font-pixel text-xl font-normal leading-none text-cyan/80">
          {downloadSource.fileSize}
        </span>
      )}
    </button>
  );
};

export default GameAction;
