import React from "react";

interface CategoryShelfHeaderProps {
  label: string;
  count: number;
  /** The shelf shows only part of the category. */
  hasMore: boolean;
  onSeeAll: (category: string) => void;
}

/** Heading of one category section, with a way into the whole category. */
export default function CategoryShelfHeader({
  label,
  count,
  hasMore,
  onSeeAll,
}: CategoryShelfHeaderProps) {
  return (
    <div className="flex items-baseline gap-4 pt-4 pb-3">
      <h2 className="text-xl font-bold text-white">
        {label} <span className="text-gray-400 text-sm font-normal">({count})</span>
      </h2>
      {hasMore && (
        <button
          type="button"
          onClick={() => onSeeAll(label)}
          aria-label={`See all ${count} ${label} games`}
          className="text-sm font-medium text-blue-300 underline underline-offset-4 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded"
        >
          See all {count}
        </button>
      )}
    </div>
  );
}
