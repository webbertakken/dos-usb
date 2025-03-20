import { DosgamesListItem } from "../../../types";
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// Fetch real games from dosgames.com
async function fetchDosGames(): Promise<DosgamesListItem[]> {
  try {
    // Fetch the popular games page specifically
    const response = await axios.get(
      "https://www.dosgames.com/category/popular",
      {
        timeout: 10000, // 10 second timeout
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );
    const $ = cheerio.load(response.data);

    const games: DosgamesListItem[] = [];

    // Find game listings
    $(".gamebox").each((i, element) => {
      // Limit to 12 games
      if (i >= 12) return false;

      const titleElement = $(element).find(".gametitle a");
      const title = titleElement.text().trim();
      const href = titleElement.attr("href") || "";
      const gamePageUrl = href.startsWith("http")
        ? href
        : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;

      // Generate a unique ID from the title
      const id = title.toLowerCase().replace(/[^\w]+/g, "-");

      // Extract thumbnail
      const thumbnail = $(element).find("img").attr("src") || "";
      const fullThumbnail = thumbnail.startsWith("http")
        ? thumbnail
        : `https://www.dosgames.com${
            thumbnail.startsWith("/") ? "" : "/"
          }${thumbnail}`;

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

    console.log(`Found ${games.length} games from dosgames.com`);
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
      // Fallback to real game URLs if fetch fails
      return NextResponse.json([
        {
          id: "doom",
          title: "DOOM",
          description:
            "One of the most influential first-person shooters in gaming history.",
          year: "1993",
          category: "FPS",
          thumbnail: "/images/doom.jpg",
          downloadUrl: "https://www.dosgames.com/game/doom",
          fileSize: "2.3 MB",
        },
        {
          id: "commander-keen",
          title: "Commander Keen",
          description:
            "A side-scrolling platform game featuring an 8-year-old genius.",
          year: "1990",
          category: "Platformer",
          thumbnail: "/images/commander-keen.jpg",
          downloadUrl:
            "https://www.dosgames.com/game/commander-keen-1-marooned-on-mars",
          fileSize: "1.1 MB",
        },
        {
          id: "oregon-trail",
          title: "The Oregon Trail",
          description:
            "Educational game about pioneers traveling the Oregon Trail in the 1800s.",
          year: "1985",
          category: "Educational",
          thumbnail: "/images/oregon-trail.jpg",
          downloadUrl: "https://www.dosgames.com/game/the-oregon-trail",
          fileSize: "0.8 MB",
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
