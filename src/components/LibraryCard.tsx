import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import { FaCheck, FaStar } from "react-icons/fa";
import { CanonicalGame } from "../domain/library/types";
import { DownloadStatus } from "../types";
import { chooseDownloadSource } from "../domain/library/select";
import { friendlyError } from "../domain/firstRun/friendlyError";
import { formatCount } from "../presentation/format/formatCount";
import PixelArt from "./PixelArt";
import GameAction from "./GameAction";

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

/** One game in the Library: its screen, what it is, and how to get it. */
const LibraryCard: React.FC<LibraryCardProps> = ({
  game,
  installed = false,
  downloadStatus,
  onDownload,
  onPlay,
  onOpen,
  online = true,
}) => {
  const isInstalled = installed || downloadStatus?.status === "completed";
  const downloadSource = chooseDownloadSource(game);
  const hasError = downloadStatus?.status === "error";
  const maxDownloads = game.sources.reduce((max, s) => Math.max(max, s.metrics.downloads ?? 0), 0);
  const siteCount = new Set(game.sources.map((s) => s.site)).size;
  const details = [game.year, game.category].filter(Boolean).join(" · ");

  const caption = hasError
    ? friendlyError(downloadStatus?.error ?? "").message
    : [
        downloadSource?.fileSize,
        `${siteCount} ${siteCount === 1 ? "source" : "sources"}`,
        maxDownloads > 0 ? `${formatCount(maxDownloads)} downloads` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-panel p-3 transition-[box-shadow,transform,border-color] has-[h3_button:focus-visible]:outline-3 has-[h3_button:focus-visible]:outline-offset-3 has-[h3_button:focus-visible]:outline-cyan motion-safe:hover:-translate-y-1 hover:border-field hover:shadow-xl hover:shadow-black/40">
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
            <PixelArt name="floppy" scale={4} />
          </div>
        )}
        <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
          {isInstalled ? (
            <span className="inline-flex -rotate-2 items-center gap-1 rounded-md bg-phosphor px-2 py-0.5 text-sm font-bold text-ink shadow-md shadow-black/40">
              <FaCheck aria-hidden="true" className="text-xs" /> On your stick
            </span>
          ) : (
            <span />
          )}
          {game.mature && (
            <span className="rounded-md bg-rose px-2 py-0.5 text-sm font-bold text-ink shadow-md shadow-black/40">
              18+
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug tracking-tight text-paper">
            <button
              type="button"
              onClick={() => onOpen(game)}
              className="text-left before:absolute before:inset-0 before:z-0 before:rounded-2xl before:content-[''] focus-visible:outline-none"
            >
              {game.title}
            </button>
          </h3>
          {typeof game.rating === "number" && (
            <span className="mt-0.5 flex shrink-0 items-center gap-1 font-pixel text-xl leading-none text-amber">
              <FaStar aria-hidden="true" className="text-sm" />
              <span className="sr-only">Rated </span>
              {game.rating}
              <span className="sr-only"> out of 5</span>
            </span>
          )}
        </div>
        <p className="font-pixel text-lg leading-tight text-muted">{details}</p>
        {game.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{game.description}</p>
        )}

        <div className="relative z-10 mt-auto pt-4">
          <GameAction
            game={game}
            installed={isInstalled}
            downloadStatus={downloadStatus}
            online={online}
            onDownload={onDownload}
            onPlay={onPlay}
          />
          <p
            className={`mt-2 line-clamp-2 min-h-10 text-sm leading-5 ${hasError ? "text-danger" : "text-faint"}`}
          >
            {caption}
          </p>
        </div>
      </div>
    </article>
  );
};

export default LibraryCard;
