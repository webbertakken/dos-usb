import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameCard from "./GameCard";
import type { Game } from "../types";

const game: Game = {
  id: "keen",
  title: "Commander Keen",
  description: "A boy genius saves the galaxy.",
  year: "1990",
  category: "Platform",
  image: "",
  path: "/stick/games/keen",
};

describe("GameCard", () => {
  it("is headed by the game's title", () => {
    render(<GameCard game={game} onPlay={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 3, name: "Commander Keen" })).toBeVisible();
  });

  it("offers to edit a downloaded game's details", async () => {
    const onEdit = vi.fn();
    render(<GameCard game={game} onPlay={vi.fn()} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit details of Commander Keen" }));

    expect(onEdit).toHaveBeenCalledWith(game);
  });

  it("marks your own game and leaves its details alone", () => {
    render(<GameCard game={{ ...game, source: "custom" }} onPlay={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Your game", { exact: true })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Edit details/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Commander Keen" })).toBeEnabled();
  });

  it("explains what a game needing attention lacks, instead of a Play button", () => {
    render(
      <GameCard
        game={{
          ...game,
          source: "custom",
          status: "needs-attention",
          attention: "Only an installer was found (INSTALL.EXE).",
        }}
        onPlay={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const reason = /^Needs attention: Only an installer was found \(INSTALL\.EXE\)\.$/;
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && reason.test(element.textContent ?? ""),
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Play/ })).not.toBeInTheDocument();
  });

  it("cannot be started twice while it is starting", () => {
    render(<GameCard game={game} onPlay={vi.fn()} onEdit={vi.fn()} starting />);

    expect(screen.getByRole("button", { name: "Play Commander Keen" })).toBeDisabled();
  });
});
