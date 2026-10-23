import React from "react";
import { FaArrowRight } from "react-icons/fa";

interface CategoryShelfHeaderProps {
  label: string;
  count: number;
  /** The shelf shows only part of the category. */
  hasMore: boolean;
  onSeeAll: (category: string) => void;
}

/** Heading of one category shelf, with a way into the whole category. */
export default function CategoryShelfHeader({
  label,
  count,
  hasMore,
  onSeeAll,
}: CategoryShelfHeaderProps) {
  return (
    <div className="flex items-center gap-4 pb-4 pt-8">
      <h2 className="flex items-baseline gap-2 font-display text-2xl font-bold tracking-tight text-paper">
        {label}{" "}
        <span className="font-pixel text-xl font-normal leading-none text-faint">({count})</span>
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {hasMore && (
        <button
          type="button"
          onClick={() => onSeeAll(label)}
          aria-label={`See all ${count} ${label} games`}
          className="group inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-cyan hover:bg-cyan/10"
        >
          See all {count}
          <FaArrowRight
            aria-hidden="true"
            className="text-xs motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </button>
      )}
    </div>
  );
}
