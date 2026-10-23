import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

const Broken = (): never => {
  throw new Error("Objects are not valid as a React child");
};

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces a crashed screen with a calm way back", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload DOS USB" })).toBeVisible();
    expect(screen.getByText("Technical details")).toBeVisible();
    expect(screen.getByText(/Objects are not valid as a React child/)).not.toBeVisible();
  });

  it("logs what crashed", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(logged).toHaveBeenCalledWith(
      "React Error Boundary caught an error:",
      expect.any(Error),
      expect.anything(),
    );
  });
});
