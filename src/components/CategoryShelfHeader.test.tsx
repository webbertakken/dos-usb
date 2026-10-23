import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryShelfHeader from "./CategoryShelfHeader";

describe("CategoryShelfHeader", () => {
  it("names the category and its game count as a heading", () => {
    render(<CategoryShelfHeader label="Action" count={439} hasMore={false} onSeeAll={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Action (439)");
  });

  it("offers every game of a category that is cut short", async () => {
    const onSeeAll = vi.fn();
    render(<CategoryShelfHeader label="Action" count={439} hasMore onSeeAll={onSeeAll} />);
    await userEvent.click(screen.getByRole("button", { name: "See all 439 Action games" }));
    expect(onSeeAll).toHaveBeenCalledWith("Action");
  });

  it("offers nothing more when the whole category is shown", () => {
    render(<CategoryShelfHeader label="Fighting" count={3} hasMore={false} onSeeAll={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
