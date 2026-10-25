import React from "react";

interface SkeletonGridProps {
  /** What is loading, for screen readers. */
  label: string;
  className: string;
  count?: number;
}

/** Card-shaped placeholders that hold the page's shape while games load. */
const SkeletonGrid: React.FC<SkeletonGridProps> = ({ label, className, count = 4 }) => (
  <div>
    <output aria-live="polite" className="sr-only">
      {label}
    </output>
    <div aria-hidden="true" className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-line bg-panel p-3 motion-safe:animate-pulse"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          <div className="aspect-[16/10] rounded-xl bg-raised" />
          <div className="mt-4 h-5 w-3/4 rounded bg-raised" />
          <div className="mt-2 h-4 w-1/2 rounded bg-raised/70" />
          <div className="mt-5 h-13 rounded-xl bg-raised/70" />
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonGrid;
