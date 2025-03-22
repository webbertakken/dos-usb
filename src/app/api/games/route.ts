import { NextResponse } from "next/server";

// Add dynamic export to fix Next.js error
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json([
    {
      id: "commander-keen-1",
      title: "Commander Keen 1: Marooned on Mars",
      description:
        "The first episode in the Commander Keen series where Billy Blaze must stop the Vorticons from destroying Earth.",
      year: "1990",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keen1.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-1-marooned-on-mars",
      fileSize: "334k",
    },
    {
      id: "commander-keen-2",
      title: "Commander Keen 2: The Earth Explodes",
      description:
        "The second episode in the series where Keen must continue his battle against the Vorticons.",
      year: "1990",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keen2.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-2-the-earth-explodes",
      fileSize: "496k",
    },
    {
      id: "commander-keen-3",
      title: "Commander Keen 3: Keen Must Die!",
      description:
        "The final episode of the Vorticons trilogy where Keen must face the Grand Intellect on the Vorticon homeworld.",
      year: "1990",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keen3.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-3-keen-must-die",
      fileSize: "532k",
    },
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
      id: "commander-keen-5",
      title: "Commander Keen 5: The Armageddon Machine",
      description:
        "The second episode in the Dreams trilogy where Keen must destroy the Shikadi Armageddon Machine.",
      year: "1991",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keen5.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-5-the-armageddon-machine",
      fileSize: "734k",
    },
    {
      id: "commander-keen-6",
      title: "Commander Keen 6: Aliens Ate My Baby Sitter!",
      description:
        "The final episode of the Dreams trilogy where Keen must rescue his babysitter from the Bloogs.",
      year: "1991",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keen6.gif",
      downloadUrl:
        "https://www.dosgames.com/game/commander-keen-6-aliens-ate-my-baby-sitter",
      fileSize: "830k",
    },
    {
      id: "commander-keen-dreams",
      title: "Commander Keen: Keen Dreams",
      description:
        "Often called 'Keen 3.5', a standalone game where Keen fights evil vegetables in his dreams.",
      year: "1991",
      category: "Platformer",
      thumbnail: "https://www.dosgames.com/screens/keendreams.gif",
      downloadUrl: "https://www.dosgames.com/game/commander-keen-keen-dreams",
      fileSize: "487k",
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
