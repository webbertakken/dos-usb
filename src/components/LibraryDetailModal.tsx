"use client";

import React from "react";
import Image from "next/image";
import { displayImageUrl } from "../presentation/images/displayImageUrl";
import { FaExternalLinkAlt, FaPlay, FaStar } from "react-icons/fa";
import { CanonicalGame } from "../domain/library/types";
import { DownloadStatus } from "../types";
import { chooseDownloadSource, distinctSites, SITE_NAMES } from "../domain/library/select";
import { friendlyError } from "../domain/firstRun/friendlyError";
import { formatCount } from "../presentation/format/formatCount";
import Dialog from "./Dialog";
import GameAction from "./GameAction";
import PixelArt from "./PixelArt";

interface LibraryDetailModalProps {
  game: CanonicalGame;
  installed: boolean;
  downloadStatus?: DownloadStatus;
  onDownload: (game: CanonicalGame) => void;
  /** Downloads need the internet; offline they say so instead of failing. */
  online?: boolean;
  onPlay: (gameId: string) => void;
  onClose: () => void;
}

const Fact: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value ? (
    <div className="min-w-0">
      <dt className="font-pixel text-lg leading-none text-faint">{label}</dt>
      <dd className="mt-1 break-words text-sm text-paper">{value}</dd>
    </div>
  ) : null;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mb-3 font-pixel text-xl leading-none text-faint">{children}</h3>
);

const LINK =
  "inline-flex items-center gap-2 rounded-lg text-sm font-medium underline underline-offset-4";
const CYAN_LINK = `${LINK} text-cyan decoration-cyan/40 hover:decoration-cyan`;
const PLAY_LINK = `${LINK} text-phosphor decoration-phosphor/40 hover:decoration-phosphor`;

/** Everything known about one Library game, and the way to get it. */
const LibraryDetailModal: React.FC<LibraryDetailModalProps> = ({
  game,
  installed,
  downloadStatus,
  onDownload,
  onPlay,
  onClose,
  online = true,
}) => {
  const titleId = React.useId();
  const isInstalled = installed || downloadStatus?.status === "completed";
  const downloadSource = chooseDownloadSource(game);
  const sites = distinctSites(game.sources);
  const license = game.sources.find((s) => s.license)?.license;
  const meta = [game.year, game.category, game.publisher].filter(Boolean).join(" · ");

  const hero = (
    <div className="relative overflow-hidden bg-night px-6 pb-6 pt-14 sm:px-10">
      {game.image && (
        <Image
          src={displayImageUrl(game.image)}
          alt=""
          aria-hidden="true"
          fill
          className="scale-125 object-cover opacity-35 blur-2xl"
          sizes="768px"
          unoptimized
        />
      )}
      <div className="crt relative mx-auto aspect-[16/10] w-full max-w-xl rounded-2xl shadow-2xl shadow-black/60">
        {game.image ? (
          <Image
            src={displayImageUrl(game.image)}
            alt={`${game.title} screenshot`}
            fill
            className="pixelated object-contain"
            sizes="(max-width: 640px) 100vw, 576px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-raised/40 text-faint">
            <PixelArt name="floppy" scale={5} />
            <span className="font-pixel text-xl">No screenshot yet</span>
          </div>
        )}
        {game.mature && (
          <span className="absolute left-3 top-3 z-10 rounded-md bg-rose px-2 py-0.5 text-sm font-bold text-ink">
            18+ Mature
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog labelledBy={titleId} onClose={onClose} hero={hero} size="lg">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-display text-3xl font-extrabold leading-tight tracking-tight text-paper"
          >
            {game.title}
          </h2>
          {meta && <p className="mt-1 font-pixel text-xl leading-tight text-muted">{meta}</p>}
        </div>
        {typeof game.rating === "number" && (
          <p className="flex items-center gap-2 font-pixel text-3xl leading-none text-amber">
            <FaStar aria-hidden="true" className="text-xl" />
            <span className="sr-only">Rated </span>
            {game.rating}
            <span className="text-xl text-faint">
              <span aria-hidden="true">/ 5</span>
              <span className="sr-only"> out of 5</span>
            </span>
          </p>
        )}
      </div>

      <div className="mt-6 max-w-sm">
        <GameAction
          game={game}
          installed={isInstalled}
          downloadStatus={downloadStatus}
          online={online}
          onDownload={onDownload}
          onPlay={onPlay}
          showSize
        />
        {downloadStatus?.status === "error" && (
          <p className="mt-2 text-sm text-danger">
            {friendlyError(downloadStatus.error ?? "").message}
          </p>
        )}
        {!downloadSource && (
          <p className="mt-2 text-sm text-faint">
            None of its sources offers a download. Some let you play it online, below.
          </p>
        )}
      </div>

      {game.description && (
        <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-muted">
          {game.description}
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-night/50 p-5 sm:grid-cols-4">
        <Fact label="Year" value={game.year} />
        <Fact label="Category" value={game.category} />
        <Fact label="Publisher" value={game.publisher} />
        <Fact label="Licence" value={license} />
        <Fact label="Resolution" value={game.resolution} />
        <Fact label="Multiplayer" value={game.multiplayer} />
        <Fact label="File size" value={downloadSource?.fileSize} />
        <Fact label="Runs" value={downloadSource?.runExe} />
      </dl>

      {game.tags.length > 0 && (
        <section className="mt-8">
          <SectionLabel>Tags</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {game.tags.slice(0, 12).map((tag) => (
              <li
                key={tag}
                className="rounded-md bg-raised px-2 py-0.5 font-pixel text-lg leading-6 text-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        </section>
      )}

      {game.links && game.links.length > 0 && (
        <section className="mt-8">
          <SectionLabel>More about it</SectionLabel>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {game.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={CYAN_LINK}>
                  {link.label}
                  <FaExternalLinkAlt aria-hidden="true" className="text-xs" />
                  <span className="sr-only">(opens in your browser)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 border-t border-line pt-6">
        <SectionLabel>
          Listed on {sites.length} {sites.length === 1 ? "source" : "sources"}
        </SectionLabel>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {sites.map((source) => (
            <li
              key={source.site + source.url}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <a href={source.url} target="_blank" rel="noopener noreferrer" className={CYAN_LINK}>
                {SITE_NAMES[source.site]}
                <FaExternalLinkAlt aria-hidden="true" className="text-xs" />
                <span className="sr-only">(opens in your browser)</span>
              </a>
              <div className="flex items-center gap-4 text-sm text-faint">
                {typeof source.metrics.downloads === "number" && (
                  <span className="font-pixel text-lg leading-none">
                    {formatCount(source.metrics.downloads)} downloads
                  </span>
                )}
                {source.playUrl && (
                  <a
                    href={source.playUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={PLAY_LINK}
                  >
                    <FaPlay aria-hidden="true" className="text-xs" /> Play online
                    <span className="sr-only">(opens in your browser)</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Dialog>
  );
};

export default LibraryDetailModal;
