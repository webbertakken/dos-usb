import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameEditModal from "./GameEditModal";
import type { Game } from "../types";

const game: Game = {
  id: "keen4",
  title: "Commander Keen 4",
  description: "Billy Blaze looks for the Oracle.",
  year: "1991",
  category: "Platformer",
  image: "/screens/commander-keen-4.gif",
  path: "/stick/games/keen4",
};

describe("GameEditModal", () => {
  it("is a dialog named for the game it edits", () => {
    render(<GameEditModal game={game} onClose={vi.fn()} onSave={vi.fn()} isLoading={false} />);

    expect(screen.getByRole("dialog", { name: "Edit Commander Keen 4" })).toBeInTheDocument();
  });

  it("saves the details, keeping a screenshot path from the stick", async () => {
    const onSave = vi.fn();
    render(<GameEditModal game={game} onClose={vi.fn()} onSave={onSave} isLoading={false} />);

    const title = screen.getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Keen 4");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith("keen4", {
      title: "Keen 4",
      description: "Billy Blaze looks for the Oracle.",
      year: "1991",
      category: "Platformer",
      image: "/screens/commander-keen-4.gif",
    });
  });

  it("keeps a category the list does not name", () => {
    render(
      <GameEditModal
        game={{ ...game, category: "Sidescrolling" }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("Sidescrolling");
  });

  it("closes on Escape and from Cancel", async () => {
    const onClose = vi.fn();
    render(<GameEditModal game={game} onClose={onClose} onSave={vi.fn()} isLoading={false} />);

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
