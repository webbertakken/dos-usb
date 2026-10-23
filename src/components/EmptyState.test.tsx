import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("names what is missing as a heading and explains it", () => {
    render(<EmptyState art="floppy" title="No games match" text="Try another word." />);

    expect(screen.getByRole("heading", { level: 2, name: "No games match" })).toBeVisible();
    expect(screen.getByText("Try another word.")).toBeVisible();
  });

  it("offers one way forward", async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        art="floppy"
        title="No games match"
        text="Try another word."
        action={{ label: "Clear search and filters", onClick: onAction }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("can lead to another page instead", () => {
    render(
      <EmptyState
        art="floppy"
        title="Your shelf is empty"
        text="Find games in the Library."
        action={{ label: "Browse the Library", href: "/library" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Browse the Library" })).toHaveAttribute(
      "href",
      "/library",
    );
  });
});
