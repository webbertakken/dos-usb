import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navigation from "./Navigation";

describe("Navigation", () => {
  it("names the collapsed menu button and reports it closed", () => {
    render(<Navigation />);

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the menu with both destinations and reports it open", async () => {
    render(<Navigation />);
    const menu = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(menu.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect([...(panel?.querySelectorAll("a") ?? [])].map((link) => link.textContent)).toEqual([
      "My Games",
      "Library",
    ]);
  });

  it("leads to My Games and the Library", () => {
    render(<Navigation />);

    expect(screen.getAllByRole("link", { name: "Library" })[0]).toHaveAttribute("href", "/library");
    expect(screen.getAllByRole("link", { name: "My Games" })[0]).toHaveAttribute("href", "/");
  });

  it("closes the menu again from the same button", async () => {
    render(<Navigation />);
    const menu = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(menu);
    await userEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
