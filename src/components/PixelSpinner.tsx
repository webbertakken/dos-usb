import React from "react";

/** Three blocks blinking in turn, like a DOS installer at work. */
const PixelSpinner: React.FC = () => (
  <span aria-hidden="true" className="inline-flex items-center gap-1">
    {[0, 300, 600].map((delay) => (
      <span
        key={delay}
        className="h-2 w-2 bg-current motion-safe:animate-blink"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </span>
);

export default PixelSpinner;
