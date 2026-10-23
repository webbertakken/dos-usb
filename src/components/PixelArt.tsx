import React from "react";

/**
 * Small pixel drawings, each a grid of characters mapped to palette colours.
 * They are decorative: hidden from assistive technology, sized explicitly so
 * they never shift the layout.
 */

const PALETTE: Record<string, string> = {
  B: "#6d5ce8", // floppy body
  S: "#cfc9dc", // metal shutter
  K: "#12101a", // ink
  W: "#f4eee3", // paper
  L: "#ff94bd", // rose
  R: "#ff94bd", // rose
  r: "#d9658f", // deep rose
  A: "#ffcb6b", // amber
  a: "#e0a446", // deep amber
  y: "#fff1b8", // flame core
  C: "#7fd6ec", // cyan
  G: "#74e3a2", // phosphor
  g: "#3f9c68", // deep phosphor
  P: "#3b3550", // plate / line
  M: "#8f87a3", // muted metal
};

export type PixelArtName = "floppy" | "cake" | "joystick" | "question" | "crash";

const ART: Record<PixelArtName, readonly string[]> = {
  floppy: [
    "BBBSSSSSSSBBB.",
    "BBBSSSSKSSBBBB",
    "BBBSSSSKSSBBBB",
    "BBBSSSSKSSBBBB",
    "BBBSSSSSSSBBBB",
    "BBBBBBBBBBBBBB",
    "BBWWWWWWWWWWBB",
    "BBWLLLLLLLLWBB",
    "BBWWWWWWWWWWBB",
    "BBWMMMMMWWWWBB",
    "BBWWWWWWWWWWBB",
    "BBWMMMMMMMWWBB",
    "BBWWWWWWWWWWBB",
    "BBBBBBBBBBBBBB",
  ],
  cake: [
    "...y....y....y...",
    "..yAy..yAy..yAy..",
    "...a....a....a...",
    "...C....C....C...",
    "...C....C....C...",
    ".WWWWWWWWWWWWWWW.",
    ".WWRWWWWCWWWWRWW.",
    ".WrWWWrWWWWrWWWr.",
    ".RRRRRRRRRRRRRRR.",
    ".RRRRRRRRRRRRRRR.",
    ".WWWWWWWWWWWWWWW.",
    ".AAAAAAAAAAAAAAA.",
    ".aAAAAAAAAAAAAAa.",
    "PPPPPPPPPPPPPPPPP",
  ],
  joystick: [
    "......RRR.....",
    ".....RRRRR....",
    ".....RRWRR....",
    ".....RRRRR....",
    "......RRR.....",
    ".......K......",
    ".......K......",
    ".......K......",
    "..PPPPPKPPPP..",
    ".PPPPPPPPPGGP.",
    ".PPPPPPPPPggP.",
    ".PPPPPPPPPPPP.",
    "..KKKKKKKKKK..",
  ],
  question: [
    "...AAAAAA...",
    "..AAAAAAAA..",
    ".AAA....AAA.",
    ".AAA....AAA.",
    "........AAA.",
    "......AAAA..",
    ".....AAA....",
    ".....AAA....",
    "............",
    ".....AAA....",
    ".....AAA....",
  ],
  crash: [
    "BBBSSSSSSSBBB.",
    "BBBSSSSKSSBBBB",
    "BBBSSSSKSSBBBB",
    "BBBSSSSSSSBBBB",
    "BBBBBBBBBBBBBB",
    "BBWWWWWWWWWWBB",
    "BBWKWKWWKWKWBB",
    "BBWWKWWWWKWWBB",
    "BBWKWKWWKWKWBB",
    "BBWWWWWWWWWWBB",
    "BBWWWKKKKWWWBB",
    "BBWWKWWWWKWWBB",
    "BBWWWWWWWWWWBB",
    "BBBBBBBBBBBBBB",
  ],
};

/** One path per colour: a unit square for every cell painted in it. */
const pathsByColour = (rows: readonly string[]): Map<string, string> => {
  const paths = new Map<string, string>();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      const colour = PALETTE[cell];
      if (colour) paths.set(colour, `${paths.get(colour) ?? ""}M${x} ${y}h1v1h-1z`);
    }),
  );
  return paths;
};

interface PixelArtProps {
  name: PixelArtName;
  /** Size of one art pixel, in CSS pixels. */
  scale?: number;
  className?: string;
}

const PixelArt: React.FC<PixelArtProps> = ({ name, scale = 4, className }) => {
  const rows = ART[name];
  const width = rows[0].length;
  const height = rows.length;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {[...pathsByColour(rows)].map(([colour, d]) => (
        <path key={colour} d={d} fill={colour} />
      ))}
    </svg>
  );
};

export default PixelArt;
