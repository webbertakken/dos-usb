import { DosgamesListItem } from "../../../types";
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// Fetch real games from dosgames.com
async function fetchDosGames(): Promise<DosgamesListItem[]> {
  try {
    // Fetch the popular games page specifically
    const response = await axios.get(
      "https://www.dosgames.com/category/popular"
    );
    const $ = cheerio.load(response.data);

    const games: DosgamesListItem[] = [];

    // Find game listings
    // @ts-expect-error - Cheerio types are complex
    $(".gamebox").each((i: number, element) => {
      // Limit to 12 games
      if (i >= 12) return false;

      const titleElement = $(element).find(".gametitle a");
      const title = titleElement.text().trim();
      const gamePageUrl =
        "https://www.dosgames.com" + titleElement.attr("href");

      // Generate a unique ID from the title
      const id = title.toLowerCase().replace(/[^\w]+/g, "-");

      // Extract thumbnail
      const thumbnail = $(element).find("img").attr("src") || "";
      const fullThumbnail = thumbnail.startsWith("http")
        ? thumbnail
        : `https://www.dosgames.com${thumbnail}`;

      // Extract description
      const description = $(element).find(".gamedesc").text().trim();

      // Get category and year if available
      const metaText = $(element).find(".gamecat").text().trim();
      const categoryMatch = metaText.match(/Category: ([^,]+)/);
      const yearMatch = metaText.match(/Released: (\d{4})/);

      const category = categoryMatch ? categoryMatch[1].trim() : "Popular";
      const year = yearMatch ? yearMatch[1] : "Unknown";

      // Check for file size if available
      const fileSizeMatch = $(element)
        .find(".gamesize")
        .text()
        .match(/(\d+(?:\.\d+)?\s*[KMG]B)/i);
      const fileSize = fileSizeMatch ? fileSizeMatch[1] : "Unknown";

      games.push({
        id,
        title,
        description,
        year,
        category,
        thumbnail: fullThumbnail,
        downloadUrl: gamePageUrl, // Use the game page URL - the main process will extract the actual download link
        fileSize,
      });
    });

    return games;
  } catch (error) {
    console.error("Error fetching games from dosgames.com:", error);
    return [];
  }
}

export async function GET() {
  try {
    const games = await fetchDosGames();

    if (games.length === 0) {
      // Fallback to mock data if fetch fails
      return NextResponse.json([
        {
          id: "doom",
          title: "DOOM",
          description:
            "One of the most influential first-person shooters in gaming history.",
          year: "1993",
          category: "FPS",
          thumbnail: "/images/doom.jpg",
          downloadUrl: "mock://games/doom.zip",
          fileSize: "2.3 MB",
        },
        // Include a few more mock games as fallback
        {
          id: "commander-keen",
          title: "Commander Keen",
          description:
            "A side-scrolling platform game featuring an 8-year-old genius.",
          year: "1990",
          category: "Platformer",
          thumbnail: "/images/commander-keen.jpg",
          downloadUrl: "mock://games/commander-keen.zip",
          fileSize: "1.1 MB",
        },
      ]);
    }

    return NextResponse.json(games);
  } catch (error) {
    console.error("Error in games API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}
