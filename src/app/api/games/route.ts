import { NextResponse } from "next/server";

// Add dynamic export to fix Next.js error
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json([
    {
      id: "commander-keen-4",
      title: "Commander Keen 4: Secret of the Oracle",
      description:
        "A well-received sidescrolling platformer developed by iD Software and published by Apogee.",
      year: "1991",
      category: "Sidescrolling",
      thumbnail: "https://www.dosgames.com/screens/keen4.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-4-secret-of-the-oracle",
      fileSize: "623k",
    },
    {
      id: "revenge-of-the-mutant-camels",
      title: "Revenge of the Mutant Camels",
      description:
        "A side-scrolling platforming shooting game where you pilot your goat riding a mutant camel.",
      year: "1994",
      category: "Action",
      thumbnail: "https://www.dosgames.com/screens/revenge.gif",
      downloadUrl: "https://www.dosgames.com/game/revenge-of-the-mutant-camels",
      fileSize: "485k",
    },
    {
      id: "inner-worlds",
      title: "Inner Worlds",
      description:
        "A puzzle platformer with beautiful graphics and challenging gameplay.",
      year: "1996",
      category: "Puzzle",
      thumbnail: "https://www.dosgames.com/screens/innerworlds.gif",
      downloadUrl: "https://www.dosgames.com/game/inner-worlds",
      fileSize: "1.1 MB",
    },
  ]);
}
