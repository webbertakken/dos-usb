import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Navigation from "./Navigation";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("Navigation", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("names the app as a link home", () => {
    render(<Navigation />);

    expect(screen.getByRole("link", { name: "DOS USB, home" })).toHaveAttribute("href", "/");
  });

  it("shows both destinations at once, with no menu to open", () => {
    render(<Navigation />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["My Games", "Library"]);
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("leads to My Games and the Library", () => {
    render(<Navigation />);

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "My Games" })).toHaveAttribute("href", "/");
  });

  it("marks the page you are on", () => {
    pathname.current = "/library";
    render(<Navigation />);

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Games" })).not.toHaveAttribute("aria-current");
  });

  it("treats the exported page path with a trailing slash as the same page", () => {
    pathname.current = "/library/";
    render(<Navigation />);

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
  });
});
