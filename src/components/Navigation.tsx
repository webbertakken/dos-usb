"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaGamepad, FaBook } from "react-icons/fa";
import PixelArt from "./PixelArt";

const DESTINATIONS = [
  { name: "My Games", path: "/", Icon: FaGamepad },
  { name: "Library", path: "/library", Icon: FaBook },
] as const;

/** The exported site serves pages with a trailing slash; both are the same page. */
const samePage = (pathname: string | null, path: string) =>
  (pathname ?? "/").replace(/(.)\/$/, "$1") === path;

/** The top bar: the app's name, and both places to go, always in view. */
const Navigation: React.FC = () => {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-line/70 bg-night/95">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="DOS USB, home"
          className="group flex items-center gap-3 rounded-lg"
        >
          <PixelArt
            name="floppy"
            scale={2}
            className="motion-safe:transition-transform motion-safe:group-hover:-rotate-6"
          />
          <span className="font-display text-xl font-extrabold tracking-tight text-paper">
            DOS USB
          </span>
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-1 rounded-xl bg-panel p-1 ring-1 ring-line">
            {DESTINATIONS.map(({ name, path, Icon }) => {
              const current = samePage(pathname, path);
              return (
                <li key={path}>
                  <Link
                    href={path}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-4 ${
                      current
                        ? "bg-raised text-paper shadow-[inset_0_-3px_0_var(--color-phosphor)]"
                        : "text-muted hover:bg-raised/60 hover:text-paper"
                    }`}
                  >
                    <Icon aria-hidden="true" className={current ? "text-phosphor" : ""} />
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Navigation;
