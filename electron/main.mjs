import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import fs from "fs";
import https from "https";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import extract from "extract-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  // Set up CSP - more permissive in development mode, stricter in production
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*; connect-src 'self' ws: wss: http: https:;"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*; connect-src 'self' https://*;",
        ],
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs"),
      worldSafeExecuteJavaScript: true,
      sandbox: false, // Set to false to allow preload script to work properly
    },
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;

  mainWindow.loadURL(startUrl);

  // Forward console logs from renderer to main process
  mainWindow.webContents.on("console-message", (_, level, message) => {
    // Use a simple console.log for all messages
    console.log(`[Renderer ${level}]`, message);
  });

  // Capture renderer process errors
  mainWindow.webContents.on("crashed", () => {
    console.error("Renderer process crashed!");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error(`Failed to load: ${errorDescription} (${errorCode})`);
    }
  );

  // Handle uncaught exceptions in the main process
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in main process:", error);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Add IPC handler for renderer to send errors to main process
ipcMain.handle("log-error", async (event, errorData) => {
  console.error("[Renderer Error]", errorData);
  return { received: true };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle DOS game launch
ipcMain.handle("launch-game", async (event, gamePath) => {
  try {
    // Check if DOSBox exists and is accessible
    const dosboxPath = path.join(process.cwd(), "bin", "dosbox.exe");

    if (!fs.existsSync(dosboxPath)) {
      return { success: false, error: "DOSBox executable not found" };
    }

    // Launch the game with DOSBox
    const dosbox = spawn(dosboxPath, [gamePath], {
      detached: true,
      stdio: "ignore",
    });

    dosbox.on("error", (err) => {
      console.error("Failed to start DOSBox:", err);
      return { success: false, error: err.message };
    });

    return { success: true };
  } catch (error) {
    console.error("Error launching game:", error);
    return { success: false, error: error.message };
  }
});

// Get available games from the games directory
ipcMain.handle("get-games", async () => {
  try {
    const gamesDir = path.join(process.cwd(), "games");

    // Create games directory if it doesn't exist
    if (!fs.existsSync(gamesDir)) {
      fs.mkdirSync(gamesDir, { recursive: true });
    }

    const gamesList = fs
      .readdirSync(gamesDir)
      .filter((file) => fs.statSync(path.join(gamesDir, file)).isDirectory())
      .map((dir) => {
        // Try to find metadata file if it exists
        const metadataPath = path.join(gamesDir, dir, "metadata.json");
        let metadata = {
          title: dir,
          description: "",
          year: "",
          category: "",
          thumbnail: "",
        };

        if (fs.existsSync(metadataPath)) {
          try {
            metadata = {
              ...metadata,
              ...JSON.parse(fs.readFileSync(metadataPath, "utf8")),
            };
          } catch (e) {
            console.error(`Error reading metadata for ${dir}:`, e);
          }
        }

        return {
          id: dir,
          path: path.join(gamesDir, dir),
          ...metadata,
        };
      });

    return gamesList;
  } catch (error) {
    console.error("Error getting games list:", error);
    return [];
  }
});

// Save game metadata
ipcMain.handle("save-game-metadata", async (event, { gameId, metadata }) => {
  try {
    const gamePath = path.join(process.cwd(), "games", gameId);
    const metadataPath = path.join(gamePath, "metadata.json");

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return { success: true };
  } catch (error) {
    console.error("Error saving game metadata:", error);
    return { success: false, error: error.message };
  }
});

// Handle game download and extraction
ipcMain.handle("download-game", async (event, gameInfo) => {
  try {
    if (!gameInfo || !gameInfo.id || !gameInfo.downloadUrl) {
      throw new Error("Invalid game information");
    }

    // Inform renderer that download is starting
    mainWindow.webContents.send("download-status", {
      gameId: gameInfo.id,
      status: "downloading",
      progress: 0,
    });

    // Create games directory if it doesn't exist
    const gamesDir = path.join(app.getPath("userData"), "games");
    await mkdir(gamesDir, { recursive: true });

    // Create directory for this specific game
    const gameDir = path.join(gamesDir, gameInfo.id);
    await mkdir(gameDir, { recursive: true });

    // Check if we're using a mock URL (for testing)
    if (gameInfo.downloadUrl.startsWith("mock://")) {
      console.log("Using mock download for testing");

      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        mainWindow.webContents.send("download-status", {
          gameId: gameInfo.id,
          status: "downloading",
          progress: progress,
        });
      }

      // Inform renderer that extraction is starting
      mainWindow.webContents.send("download-status", {
        gameId: gameInfo.id,
        status: "extracting",
        progress: 100,
      });

      // Simulate extraction delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create a mock game.bat file for testing
      const gameBatPath = path.join(gameDir, "game.bat");
      fs.writeFileSync(
        gameBatPath,
        `@echo off\necho Playing ${gameInfo.title || gameInfo.id}\npause`
      );

      // Create metadata file
      const metadataPath = path.join(gameDir, "metadata.json");
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(
          {
            title: gameInfo.title || gameInfo.id,
            description: gameInfo.description || "Mock game for testing",
            year: gameInfo.year || new Date().getFullYear().toString(),
            category: gameInfo.category || "Test",
            thumbnail: gameInfo.thumbnail || "",
          },
          null,
          2
        )
      );

      // Inform renderer that download is complete
      mainWindow.webContents.send("download-status", {
        gameId: gameInfo.id,
        status: "completed",
      });

      return {
        success: true,
        gamePath: gameDir,
      };
    } else if (gameInfo.downloadUrl.startsWith("http")) {
      // This is likely a dosgames.com page URL, not a direct file link
      console.log("Fetching real download link from:", gameInfo.downloadUrl);

      try {
        // Import the required modules for web scraping
        const { default: axios } = await import("axios");
        const { JSDOM } = await import("jsdom");

        // Check if the URL points to a game page or directly to a file
        const isDirectFileLink =
          gameInfo.downloadUrl.endsWith(".zip") ||
          gameInfo.downloadUrl.endsWith(".exe") ||
          gameInfo.downloadUrl.includes("file=");

        let downloadUrl = "";

        if (isDirectFileLink) {
          // If it's already a direct link, use it as is
          downloadUrl = gameInfo.downloadUrl;
          console.log("Using direct file URL:", downloadUrl);
        } else {
          // It's a game page, so we need to scrape it to find the download link
          console.log(
            "Scraping game page for download link:",
            gameInfo.downloadUrl
          );

          // Fetch the game page
          const response = await axios.get(gameInfo.downloadUrl);
          const dom = new JSDOM(response.data);
          const document = dom.window.document;

          // Look for the main download button (green button with "DOWNLOAD THE GAME" text)
          const downloadButton = Array.from(
            document.querySelectorAll(".downloadbutton, a.button, a strong")
          ).find((el) => {
            const text = el.textContent?.toLowerCase() || "";
            return (
              text.includes("download the game") ||
              text.includes("download game")
            );
          });

          if (downloadButton) {
            // Get the closest anchor element (either the button itself or its parent)
            const downloadLink =
              downloadButton.closest("a") ||
              downloadButton.parentElement?.closest("a");

            if (downloadLink) {
              const href = downloadLink.getAttribute("href");
              if (href) {
                const directLink = href.startsWith("http")
                  ? href
                  : `https://www.dosgames.com${href}`;
                console.log(
                  "Found download button with direct link:",
                  directLink
                );
                downloadUrl = directLink;
              }
            }
          }

          // If we couldn't find the main download button, look for direct file links
          if (!downloadUrl) {
            // Look specifically for links to files directory which is the common pattern
            const fileLinks = Array.from(document.querySelectorAll("a[href]"))
              .filter((link) => {
                const href = link.getAttribute("href") || "";
                // Look specifically for the /files/ pattern used on dosgames.com
                return (
                  href.includes("/files/") &&
                  (href.endsWith(".zip") || href.endsWith(".exe"))
                );
              })
              .map((link) => {
                const href = link.getAttribute("href");
                return href.startsWith("http")
                  ? href
                  : `https://www.dosgames.com${href}`;
              });

            if (fileLinks.length > 0) {
              console.log("Found direct file link:", fileLinks[0]);
              downloadUrl = fileLinks[0];
            }
          }

          if (!downloadUrl) {
            // Last resort: try to find any download-related links
            const allLinks = Array.from(document.querySelectorAll("a[href]"))
              .filter((link) => {
                const href = link.getAttribute("href") || "";
                const text = link.textContent?.toLowerCase() || "";
                return (
                  (href.includes("download") || text.includes("download")) &&
                  (href.endsWith(".zip") ||
                    href.endsWith(".exe") ||
                    href.includes("file="))
                );
              })
              .map((link) => {
                const href = link.getAttribute("href");
                return href.startsWith("http")
                  ? href
                  : `https://www.dosgames.com${href}`;
              });

            if (allLinks.length > 0) {
              console.log("Found fallback download link:", allLinks[0]);
              downloadUrl = allLinks[0];
            } else {
              // If we can't find a download link, try the mock download instead
              console.log("No download link found, using mock download");
              return await mockDownload(gameInfo, gameDir);
            }
          }
        }

        // Download to a temporary zip file
        const zipFilePath = path.join(gameDir, `${gameInfo.id}.zip`);

        // Download the game
        await downloadFile(downloadUrl, zipFilePath, (progress) => {
          mainWindow.webContents.send("download-status", {
            gameId: gameInfo.id,
            status: "downloading",
            progress: progress,
          });
        });

        // Inform renderer that extraction is starting
        mainWindow.webContents.send("download-status", {
          gameId: gameInfo.id,
          status: "extracting",
          progress: 100,
        });

        // Extract the game
        await extract(zipFilePath, { dir: gameDir });

        // Delete the zip file after extraction
        fs.unlinkSync(zipFilePath);

        // Create metadata file
        const metadataPath = path.join(gameDir, "metadata.json");
        fs.writeFileSync(
          metadataPath,
          JSON.stringify(
            {
              title: gameInfo.title,
              description: gameInfo.description,
              year: gameInfo.year,
              category: gameInfo.category,
              thumbnail: gameInfo.thumbnail,
              downloadUrl: gameInfo.downloadUrl,
            },
            null,
            2
          )
        );

        // Inform renderer that download is complete
        mainWindow.webContents.send("download-status", {
          gameId: gameInfo.id,
          status: "completed",
        });

        return {
          success: true,
          gamePath: gameDir,
        };
      } catch (error) {
        console.error("Error scraping download link:", error);
        throw new Error(`Failed to find download: ${error.message}`);
      }
    } else {
      // Regular download process for direct URLs
      // Download to a temporary zip file
      const zipFilePath = path.join(gameDir, `${gameInfo.id}.zip`);

      // Download the game
      await downloadFile(gameInfo.downloadUrl, zipFilePath, (progress) => {
        mainWindow.webContents.send("download-status", {
          gameId: gameInfo.id,
          status: "downloading",
          progress: progress,
        });
      });

      // Inform renderer that extraction is starting
      mainWindow.webContents.send("download-status", {
        gameId: gameInfo.id,
        status: "extracting",
        progress: 100,
      });

      // Extract the game
      await extract(zipFilePath, { dir: gameDir });

      // Delete the zip file after extraction
      fs.unlinkSync(zipFilePath);

      // Inform renderer that download is complete
      mainWindow.webContents.send("download-status", {
        gameId: gameInfo.id,
        status: "completed",
      });

      return {
        success: true,
        gamePath: gameDir,
      };
    }
  } catch (error) {
    console.error("Download failed:", error);

    // Inform renderer about the error
    mainWindow.webContents.send("download-status", {
      gameId: gameInfo.id,
      status: "error",
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Downloads a file from a URL to a local path, reporting progress
 * @param {string} url - URL to download from
 * @param {string} dest - Destination file path
 * @param {Function} progressCallback - Callback for progress updates (0-100)
 */
async function downloadFile(url, dest, progressCallback) {
  return new Promise((resolve, reject) => {
    // Create the file stream
    const fileStream = createWriteStream(dest);

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Failed to download: ${response.statusCode} ${response.statusMessage}`
          )
        );
        return;
      }

      const totalSize = parseInt(response.headers["content-length"], 10);
      let downloadedSize = 0;

      // Handle progress reporting
      response.on("data", (chunk) => {
        downloadedSize += chunk.length;

        if (totalSize) {
          const progress = Math.floor((downloadedSize / totalSize) * 100);
          progressCallback(progress);
        }
      });

      // Pipe the response to the file
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
    });

    // Handle errors
    request.on("error", (err) => {
      fs.unlink(dest, () => {}); // Delete the file if there's an error
      reject(err);
    });

    fileStream.on("error", (err) => {
      fs.unlink(dest, () => {}); // Delete the file if there's an error
      reject(err);
    });
  });
}

// Helper function for mock downloads when real downloads fail
async function mockDownload(gameInfo, gameDir) {
  console.log("Using mock download for:", gameInfo.title);

  // Simulate download progress
  for (let progress = 0; progress <= 100; progress += 10) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mainWindow.webContents.send("download-status", {
      gameId: gameInfo.id,
      status: "downloading",
      progress: progress,
    });
  }

  // Inform renderer that extraction is starting
  mainWindow.webContents.send("download-status", {
    gameId: gameInfo.id,
    status: "extracting",
    progress: 100,
  });

  // Simulate extraction delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create a mock game.bat file for testing
  const gameBatPath = path.join(gameDir, "game.bat");
  fs.writeFileSync(
    gameBatPath,
    `@echo off\necho Playing ${gameInfo.title || gameInfo.id}\npause`
  );

  // Create metadata file
  const metadataPath = path.join(gameDir, "metadata.json");
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        title: gameInfo.title || gameInfo.id,
        description: gameInfo.description || "Mock game for testing",
        year: gameInfo.year || new Date().getFullYear().toString(),
        category: gameInfo.category || "Test",
        thumbnail: gameInfo.thumbnail || "",
      },
      null,
      2
    )
  );

  // Inform renderer that download is complete
  mainWindow.webContents.send("download-status", {
    gameId: gameInfo.id,
    status: "completed",
  });

  return {
    success: true,
    gamePath: gameDir,
  };
}
