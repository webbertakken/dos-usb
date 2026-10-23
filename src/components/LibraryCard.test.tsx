import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LibraryCard from "./LibraryCard";
import type { CanonicalGame } from "../domain/library/types";

const game: CanonicalGame = {
  id: "keen-1",
  title: "Commander Keen",
  year: "1990",
  category: "Platformer",
  publisher: "Apogee",
  description: "Billy Blaze saves the galaxy.",
  tags: [],
  mature: false,
  popularity: 1,
  rating: 4.5,
  sources: [
    {
      site: "dosgames",
      siteName: "DOSGames.com",
      title: "Commander Keen",
      year: "1990",
      url: "https://www.dosgames.com/game/commander-keen",
      downloadUrl: "https://www.dosgames.com/files/DOSBOX_KEEN.ZIP",
      fileSize: "353k",
      metrics: { downloads: 120_000 },
    },
  ],
};

const renderCard = (props: Partial<React.ComponentProps<typeof LibraryCard>> = {}) => {
  const handlers = { onDownload: vi.fn(), onPlay: vi.fn(), onOpen: vi.fn() };
  render(<LibraryCard game={game} {...handlers} {...props} />);
  return handlers;
};

describe("LibraryCard", () => {
  it("is headed by the title, which opens the game's details", async () => {
    const { onOpen } = renderCard();

    const heading = screen.getByRole("heading", { level: 3, name: "Commander Keen" });
    await userEvent.click(screen.getByRole("button", { name: "Commander Keen" }));

    expect(heading).toBeVisible();
    expect(onOpen).toHaveBeenCalledWith(game);
  });

  it("downloads a game that is not on the stick", async () => {
    const { onDownload } = renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Download Commander Keen" }));

    expect(onDownload).toHaveBeenCalledWith(game);
  });

  it("plays a game that is already on the stick", async () => {
    const { onPlay } = renderCard({ installed: true });

    await userEvent.click(screen.getByRole("button", { name: "Play Commander Keen" }));

    expect(onPlay).toHaveBeenCalledWith("keen-1");
  });

  it("shows how far a download has come", () => {
    renderCard({ downloadStatus: { gameId: "keen-1", status: "downloading", progress: 42 } });

    expect(screen.getByRole("progressbar", { name: "Downloading Commander Keen" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByText("Downloading 42%")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("says what went wrong in plain words and offers a retry", async () => {
    const { onDownload } = renderCard({
      downloadStatus: { gameId: "keen-1", status: "error", error: "getaddrinfo ENOTFOUND x" },
    });

    expect(screen.getByText(/needs an internet connection/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry Commander Keen" }));
    expect(onDownload).toHaveBeenCalledWith(game);
  });

  it("needs the internet to download, and says so while offline", () => {
    renderCard({ online: false });

    expect(screen.getByRole("button", { name: "Needs internet" })).toBeDisabled();
  });

  it("says plainly when no source offers a download", () => {
    renderCard({ game: { ...game, sources: [{ ...game.sources[0], downloadUrl: undefined }] } });

    expect(screen.getByRole("button", { name: /No download/ })).toBeDisabled();
  });
});
