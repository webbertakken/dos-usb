import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WelcomePanel from "./WelcomePanel";
import ControlsHelp from "./ControlsHelp";
import FriendlyErrorNotice from "./FriendlyErrorNotice";
import GameCard from "./GameCard";
import type { Game } from "../types";

describe("WelcomePanel", () => {
  it("greets the recipient with the message and who it is from", () => {
    render(
      <WelcomePanel
        gift={{ recipientName: "Sam", message: "Enjoy the classics!", from: "Webber" }}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Happy birthday, Sam!" })).toBeVisible();
    expect(screen.getByText("Enjoy the classics!")).toBeVisible();
    expect(screen.getByText("With love, Webber")).toBeVisible();
  });

  it("welcomes plainly without a gift message", () => {
    render(<WelcomePanel gift={null} onDismiss={() => {}} />);

    expect(screen.getByRole("heading", { level: 2, name: "Welcome to DOS USB" })).toBeVisible();
  });

  it("explains how to start playing in a few steps", () => {
    render(<WelcomePanel gift={null} onDismiss={() => {}} />);

    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("is dismissed with one obvious button", async () => {
    const onDismiss = vi.fn();
    render(<WelcomePanel gift={null} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Let's play" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("ControlsHelp", () => {
  it("names the keys for fullscreen, quitting and freeing the mouse", () => {
    render(<ControlsHelp />);

    const help = screen.getByRole("region", { name: "Game controls" });
    expect(help).toHaveTextContent(/Alt\s*\+\s*Enter/);
    expect(help).toHaveTextContent(/Ctrl\s*\+\s*F10/);
    expect(help).toHaveTextContent(/Ctrl\s*\+\s*F9/);
  });
});

describe("FriendlyErrorNotice", () => {
  it("speaks plainly and keeps the technical text behind a disclosure", () => {
    render(<FriendlyErrorNotice error="getaddrinfo ENOTFOUND archive.org" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/needs an internet connection/);
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText("getaddrinfo ENOTFOUND archive.org")).not.toBeVisible();
  });

  it("offers a retry when given one", async () => {
    const onRetry = vi.fn();
    render(<FriendlyErrorNotice error="boom" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("can be closed when given a way to", async () => {
    const onDismiss = vi.fn();
    render(<FriendlyErrorNotice error="boom" onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Close message" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("GameCard", () => {
  const game: Game = {
    id: "keen",
    title: "Commander Keen",
    description: "A boy genius saves the galaxy.",
    year: "1990",
    category: "Platform",
    image: "",
    path: "/stick/games/keen",
  };

  it("has a big play button named after the game", async () => {
    const onPlay = vi.fn();
    render(<GameCard game={game} onPlay={onPlay} onEdit={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Play Commander Keen" }));

    expect(onPlay).toHaveBeenCalledWith("keen");
  });

  it("shows the game is starting while it launches", () => {
    render(<GameCard game={game} onPlay={() => {}} onEdit={() => {}} starting />);

    expect(screen.getByRole("button", { name: "Play Commander Keen" })).toHaveTextContent(
      "Starting",
    );
  });
});
