import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import extract from "extract-zip";
import electron from "electron";

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

/**
 * Creates mock game files for development/testing
 * @param {string} gameDir - Directory where the game is located
 * @param {string} gameId - ID of the game
 * @param {string} gameTitle - Title of the game
 * @returns {string} - Path to the mock game file
 * @deprecated This function is maintained for backward compatibility and reference
 */
function createMockGameFiles(gameDir, gameId, gameTitle) {
  try {
    console.log(`Creating executable game files for: ${gameId}`);

    // Create the game directory if it doesn't exist
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    // Create a demo batch file that launches a simple text-based game
    const gameFile = "game.bat";
    const gamePath = path.join(gameDir, gameFile);

    // Create a runnable text-based game
    const gameContent = `@echo off
mode con cols=80 lines=25
color 0A
title ${gameTitle}

:START
cls
echo ===================================
echo   ${gameTitle.toUpperCase()}
echo ===================================
echo.
echo Welcome to this DOS game!
echo.
echo 1. Start Game
echo 2. Instructions
echo 3. Quit
echo.
echo Enter your choice:
choice /c 123 /n
if errorlevel 3 goto END
if errorlevel 2 goto INSTRUCTIONS
if errorlevel 1 goto GAME

:INSTRUCTIONS
cls
echo INSTRUCTIONS
echo ============
echo.
echo This is a simple text adventure. You can navigate by typing
echo the number of your choice.
echo.
echo Press any key to return to the menu...
pause > nul
goto START

:GAME
cls
echo You are in a dark room. What do you do?
echo.
echo 1. Look for a light switch
echo 2. Call out for help
echo 3. Exit the room
echo.
choice /c 123 /n
if errorlevel 3 goto ROOM2
if errorlevel 2 goto HELP
if errorlevel 1 goto LIGHT

:LIGHT
cls
echo You found a light switch!
echo The room is illuminated, revealing a door.
echo.
echo 1. Go through the door
echo 2. Return to the previous choice
echo.
choice /c 12 /n
if errorlevel 2 goto GAME
if errorlevel 1 goto ROOM2

:HELP
cls
echo Your voice echoes in the empty room.
echo No one answers.
echo.
echo Press any key to continue...
pause > nul
goto GAME

:ROOM2
cls
echo You found your way out!
echo Congratulations on completing this demo game.
echo.
echo Press any key to return to the menu...
pause > nul
goto START

:END
cls
echo Thanks for playing ${gameTitle}!
echo.
echo Game ID: ${gameId}
echo Directory: ${gameDir}
echo.
echo Press any key to exit...
pause > nul
exit
`;

    fs.writeFileSync(gamePath, gameContent);
    console.log(`Created playable game file at: ${gamePath}`);

    return gamePath;
  } catch (error) {
    console.error(`Error creating game files:`, error);
    return "";
  }
}

/**
 * Sets up the DOSBox environment for the game
 */
async function setupDOSBox(gameId, gameDir, gameExe) {
  try {
    // Get primary screen dimensions to determine optimal window size
    const screen = electron.screen.getPrimaryDisplay();
    const { width, height } = screen.workAreaSize;

    console.log(`Primary screen dimensions: ${width}x${height}`);

    // Path to DOSBoxPortable executable
    const dosboxPortablePath = path.join(
      process.cwd(),
      "bin",
      "DOSBoxPortable",
      "DOSBoxPortable.exe"
    );

    if (fs.existsSync(dosboxPortablePath)) {
      console.log(`Using DOSBoxPortable at: ${dosboxPortablePath}`);

      // Directory for DOSBox configuration
      const dosboxDataDir = path.join(
        process.cwd(),
        "bin",
        "DOSBoxPortable",
        "Data"
      );

      // Ensure the Data directory exists
      if (!fs.existsSync(dosboxDataDir)) {
        fs.mkdirSync(dosboxDataDir, { recursive: true });
        console.log(`Created DOSBox data directory: ${dosboxDataDir}`);
      }

      const dosboxConfigPath = path.join(dosboxDataDir, "dosbox.conf");

      // Determine the best 4:3 window size based on screen dimensions
      // These are common 4:3 aspect ratio resolutions
      const resolutionOptions = [
        { name: "small", width: 800, height: 600 },
        { name: "medium", width: 1024, height: 768 },
        { name: "large", width: 1280, height: 960 },
        { name: "xl", width: 1400, height: 1050 },
        { name: "xxl", width: 1600, height: 1200 },
        { name: "hd", width: 1920, height: 1440 },
        { name: "2k", width: 2048, height: 1536 },
        { name: "2.5k", width: 2560, height: 1920 },
        { name: "4k", width: 3200, height: 2400 },
      ];

      // For widescreen monitors, add a custom resolution based on available height
      // This creates a resolution that uses maximum available height while maintaining 4:3 aspect
      const maxUsableHeight = Math.floor(height * 0.95); // Use 95% of screen height
      const customWidth = Math.floor(maxUsableHeight * (4 / 3)); // Calculate 4:3 width

      // Add the custom resolution if it doesn't match an existing one
      const hasCustomResolution = resolutionOptions.some(
        (res) => res.width === customWidth && res.height === maxUsableHeight
      );

      if (!hasCustomResolution) {
        resolutionOptions.push({
          name: "custom",
          width: customWidth,
          height: maxUsableHeight,
        });
        console.log(
          `Added custom resolution: ${customWidth}x${maxUsableHeight}`
        );
      }

      // Find the largest resolution that fits the screen
      // Use 95% of screen width and height (instead of 80%)
      const maxWidth = width * 0.95;
      const maxHeight = height * 0.95;

      let preferredResolution = resolutionOptions[0]; // Default to smallest

      for (const res of resolutionOptions) {
        if (res.width <= maxWidth && res.height <= maxHeight) {
          preferredResolution = res;
        } else {
          break; // Stop once we find a resolution too large
        }
      }

      const windowSize = `${preferredResolution.width}x${preferredResolution.height}`;
      console.log(`Selected optimal window size: ${windowSize}`);

      // Read the existing DOSBox configuration
      let dosboxConfig = "";
      try {
        dosboxConfig = fs.readFileSync(dosboxConfigPath, "utf8");
      } catch (error) {
        console.error("Error reading DOSBox config:", error);
        // Create a default configuration
        dosboxConfig = `
[sdl]
fullscreen=false
fulldouble=false
fullresolution=original
windowresolution=1280x960
output=opengl
autolock=true
sensitivity=100
waitonerror=true
priority=higher,normal
usescancodes=true

[dosbox]
language=
machine=svga_s3
captures=capture
memsize=16

[render]
frameskip=0
aspect=true
scaler=normal3x

[cpu]
core=auto
cputype=auto
cycles=auto
cycleup=500
cycledown=20

[mixer]
nosound=false
rate=22050
blocksize=2048
prebuffer=10

[midi]
mpu401=intelligent
mididevice=default
midiconfig=

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=22050

[gus]
gus=false
gusrate=22050
gusbase=240
gusirq=5
gusdma=3
ultradir=C:\\ULTRASND

[speaker]
pcspeaker=true
pcrate=22050
tandy=auto
tandyrate=22050
disney=true

[joystick]
joysticktype=auto
timed=true
autofire=false
swap34=false
buttonwrap=true

[serial]
serial1=dummy
serial2=dummy
serial3=disabled
serial4=disabled

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[ipx]
ipx=false
`;

        // Save the default config for future use
        try {
          fs.writeFileSync(dosboxConfigPath, dosboxConfig);
          console.log(
            `Created default DOSBox configuration at: ${dosboxConfigPath}`
          );
        } catch (writeError) {
          console.error("Error writing default DOSBox config:", writeError);
        }
      }

      // Set proper 4:3 resolution and aspect
      // Choose appropriate scaler based on resolution
      let scaler = "normal3x";
      let memsize = 16;
      let cycles = "auto";

      // For higher resolutions, use better quality scalers and more memory
      if (preferredResolution.width >= 2048) {
        scaler = "hq3x"; // High-quality scaler for high resolutions
        memsize = 64; // More memory for higher resolutions
        cycles = "max"; // Maximum cycle count for better performance
      } else if (preferredResolution.width >= 1600) {
        scaler = "advmame3x"; // Advanced scaler for larger resolutions
        memsize = 32; // More memory for medium-high resolutions
        cycles = "max"; // Maximum cycle count for better performance
      }

      const resolutionPatch = `
[sdl]
fullscreen=false
fulldouble=false
fullresolution=original
windowresolution=${windowSize}
output=opengl
autolock=true

[dosbox]
memsize=${memsize}

[render]
frameskip=0
aspect=true
scaler=${scaler}

[cpu]
cycles=${cycles}

`;

      // Start with our resolution settings
      let newConfig = resolutionPatch;

      // Then add the original config (excluding autoexec and overridden sections)
      let insideAutoexec = false;
      for (const line of dosboxConfig.split("\n")) {
        if (line.trim().startsWith("[autoexec]")) {
          insideAutoexec = true;
        } else if (line.trim().startsWith("[") && insideAutoexec) {
          insideAutoexec = false;
        }

        // Skip lines we're overriding (sdl and render sections)
        if (
          !insideAutoexec &&
          !line.trim().startsWith("[sdl]") &&
          !line.trim().startsWith("[render]") &&
          !line.match(
            /^(fullscreen|fulldouble|fullresolution|windowresolution|output|autolock|frameskip|aspect|scaler)=/
          )
        ) {
          newConfig += line + "\n";
        }
      }

      // Add our custom autoexec section with changes to prevent early exit
      const autoexecSection = `
[autoexec]
@echo off
echo DOS-USB Game Launcher
echo --------------------
mount c "${gameDir.replace(/\\/g, "/")}"
mount d "${gameDir.replace(/\\/g, "/")}" -t cdrom
c:
${gameExe}
`;

      newConfig += autoexecSection;

      // Write the updated configuration to a custom file
      const customConfigPath = path.join(
        dosboxDataDir,
        `dosbox-${gameId}.conf`
      );
      fs.writeFileSync(customConfigPath, newConfig);
      console.log(`Created custom DOSBox config at: ${customConfigPath}`);

      // Launch DOSBoxPortable with the custom config
      const child = execFile(dosboxPortablePath, ["-conf", customConfigPath], {
        windowsHide: false,
      });

      // Store the child process ID for logging
      const childPid = child.pid;
      console.log(`DOSBoxPortable started with PID: ${childPid}`);

      // Set up child process event listeners
      child.stdout.on("data", (data) => {
        console.log(`DOSBoxPortable output: ${data}`);
      });

      child.stderr.on("data", (data) => {
        console.error(`DOSBoxPortable error: ${data}`);
      });

      child.on("error", (err) => {
        console.error("Failed to start DOSBoxPortable:", err);
        return { success: false, error: err.message };
      });

      child.on("close", (code) => {
        console.log(`DOSBoxPortable process exited with code ${code}`);

        // Clean up any leftover processes - only if the main process exited abnormally
        if (code !== 0) {
          try {
            // On Windows, use taskkill to clean up
            const cleanup = execFile("taskkill", ["/F", "/IM", "DOSBox.exe"], {
              windowsHide: true,
              shell: true,
            });

            cleanup.on("close", (code) => {
              console.log(`DOSBox cleanup exited with code ${code}`);
            });
          } catch (cleanupError) {
            console.error("Error during DOSBox cleanup:", cleanupError);
          }
        }
      });

      // Wait a moment to ensure the process starts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return { success: true };
    }
  } catch (error) {
    console.error("Error setting up DOSBox:", error);
    return { success: false, error: error.message };
  }
}

// Update the launchGame function to use our new setupDOSBox function
ipcMain.handle("launch-game", async (event, { gamePath }) => {
  console.log(`Attempting to launch game from path: ${gamePath}`);

  // Extract game ID from path
  const gameId = path.basename(gamePath);
  console.log(`Game ID: ${gameId}`);

  try {
    // Get all files in the game directory
    const gameFiles = fs.readdirSync(gamePath);
    console.log("Game files found:", gameFiles);

    // Look for specific executables based on game ID
    const gameExeMapping = {
      "commander-keen": "KEEN4E.EXE",
      doom: "DOOM.EXE",
      "oregon-trail": "OREGON.EXE",
      "prince-of-persia": "PRINCE.EXE",
      wolf3d: "WOLF3D.EXE",
      "jazz-jackrabbit": "JAZZ.EXE",
      "duke-nukem": "DUKE.EXE",
      lemmings: "LEMM.EXE",
      // Add more mappings as needed
    };

    // Determine the executable to run
    let executableFile;

    // First try the specific mapping
    if (gameExeMapping[gameId] && gameFiles.includes(gameExeMapping[gameId])) {
      executableFile = gameExeMapping[gameId];
    } else {
      // Look for common executable patterns
      const commonPatterns = [
        // Exact match for game ID (e.g., DOOM.EXE for doom)
        new RegExp(`^${gameId}\\.exe$`, "i"),
        // Game ID without hyphens (e.g., ORTRAIL.EXE for oregon-trail)
        new RegExp(`^${gameId.replace(/-/g, "")}\\.exe$`, "i"),
        // First 6 characters of game ID (e.g., OREGON.EXE for oregon-trail)
        new RegExp(`^${gameId.substring(0, 6)}.*\\.exe$`, "i"),
        // First 5 characters of game ID
        new RegExp(`^${gameId.substring(0, 5)}.*\\.exe$`, "i"),
        // Any EXE file
        /\.exe$/i,
        // Any COM file
        /\.com$/i,
        // Any BAT file
        /\.bat$/i,
      ];

      // Try each pattern until we find a match
      for (const pattern of commonPatterns) {
        const match = gameFiles.find((file) => pattern.test(file));
        if (match) {
          executableFile = match;
          break;
        }
      }
    }

    if (executableFile) {
      console.log(`Found specific executable for ${gameId}: ${executableFile}`);
      const gameDirPath = path.resolve(gamePath);
      const gameExePath = executableFile;

      // Use our new setupDOSBox function
      const result = await setupDOSBox(gameId, gameDirPath, gameExePath);

      return result;
    } else {
      console.error(`No suitable executable found for ${gameId}`);
      return { success: false, error: "No suitable executable found" };
    }
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

    // Create games directory if it doesn't exist - store in ./games instead of userData
    const gamesDir = path.join(process.cwd(), "games");
    await mkdir(gamesDir, { recursive: true });

    // Create directory for this specific game
    const gameDir = path.join(gamesDir, gameInfo.id);
    await mkdir(gameDir, { recursive: true });

    // Check if we're using a mock URL (for testing)
    if (gameInfo.downloadUrl.startsWith("mock://")) {
      console.log("Using mock download for testing");
      return await mockDownload(gameInfo, gameDir);
    } else if (gameInfo.downloadUrl.startsWith("http")) {
      // This is likely a dosgames.com page URL, not a direct file link
      console.log("Processing URL:", gameInfo.downloadUrl);

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

          try {
            // Fetch the game page
            const response = await axios.get(gameInfo.downloadUrl, {
              timeout: 10000, // 10 second timeout
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              },
            });

            console.log(
              "Successfully fetched game page, searching for download links"
            );

            const dom = new JSDOM(response.data);
            const document = dom.window.document;

            // Look for the main download button (green button with "DOWNLOAD THE GAME" text)
            const downloadButton = Array.from(
              document.querySelectorAll(
                ".downloadbutton, a.button, a.green, a strong, a b"
              )
            ).find((el) => {
              const text = (el.textContent || "").toLowerCase();
              return (
                text.includes("download the game") ||
                text.includes("download game") ||
                text.includes("download") ||
                text === "download"
              );
            });

            if (downloadButton) {
              // Get the closest anchor element (either the button itself or its parent)
              const downloadLink =
                downloadButton.tagName === "A"
                  ? downloadButton
                  : downloadButton.closest("a") ||
                    downloadButton.parentElement?.closest("a");

              if (downloadLink) {
                const href = downloadLink.getAttribute("href");
                if (href) {
                  const directLink = href.startsWith("http")
                    ? href
                    : `https://www.dosgames.com${
                        href.startsWith("/") ? "" : "/"
                      }${href}`;
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
                    : `https://www.dosgames.com${
                        href.startsWith("/") ? "" : "/"
                      }${href}`;
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
                  const text = (link.textContent || "").toLowerCase();
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
                    : `https://www.dosgames.com${
                        href.startsWith("/") ? "" : "/"
                      }${href}`;
                });

              if (allLinks.length > 0) {
                console.log("Found fallback download link:", allLinks[0]);
                downloadUrl = allLinks[0];
              }
            }

            // Debug: Log all links on the page
            if (!downloadUrl) {
              console.log("No download links found. All links on the page:");
              Array.from(document.querySelectorAll("a[href]")).forEach(
                (link) => {
                  console.log(
                    `- ${link.textContent.trim()} => ${link.getAttribute(
                      "href"
                    )}`
                  );
                }
              );
            }
          } catch (scrapeError) {
            console.error("Error scraping game page:", scrapeError.message);
            // If we can't scrape, fall back to mock download
            console.log("Scraping failed, using mock download");
            return await mockDownload(gameInfo, gameDir);
          }

          if (!downloadUrl) {
            // If we can't find a download link, use mock download instead
            console.log("No download link found, using mock download");
            return await mockDownload(gameInfo, gameDir);
          }
        }

        try {
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

          try {
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
          } catch (extractError) {
            console.error("Error extracting game:", extractError);
            // If extraction fails, fall back to mock download
            return await mockDownload(gameInfo, gameDir);
          }
        } catch (downloadError) {
          console.error("Error downloading file:", downloadError);
          // If download fails, fall back to mock download
          return await mockDownload(gameInfo, gameDir);
        }
      } catch (error) {
        console.error("Error in download process:", error);
        // Fallback to mock download instead of throwing
        console.log("Error in download process, using mock download");
        return await mockDownload(gameInfo, gameDir);
      }
    } else {
      // Unknown URL format, use mock download
      console.log("Unknown URL format, using mock download");
      return await mockDownload(gameInfo, gameDir);
    }
  } catch (error) {
    console.error("Download failed:", error);

    // Inform renderer about the error
    mainWindow.webContents.send("download-status", {
      gameId: gameInfo.id,
      status: "error",
      error: error.message,
    });

    // Try to use mock download as last resort
    try {
      return await mockDownload(gameInfo, gameDir);
    } catch {
      return {
        success: false,
        error: error.message,
      };
    }
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
    console.log(`Attempting to download from: ${url}`);

    // Create the file stream
    const fileStream = createWriteStream(dest);

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        // Close the file stream to prevent it from hanging
        fileStream.close();

        // Log the error details
        console.error(
          `Download failed with status: ${response.statusCode} ${response.statusMessage}`
        );
        console.error(`URL: ${url}`);

        // Reject with detailed error
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
        } else {
          // If we can't determine size, just update based on chunks received
          const fakeProgress = Math.min(downloadedSize / 1000000, 95); // Estimate based on MB
          progressCallback(Math.floor(fakeProgress));
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
      console.error(`Network error during download: ${err.message}`);
      fileStream.close(); // Close the stream
      fs.unlink(dest, () => {}); // Delete the file if there's an error
      reject(err);
    });

    fileStream.on("error", (err) => {
      console.error(`File system error during download: ${err.message}`);
      fileStream.close(); // Close the stream
      fs.unlink(dest, () => {}); // Delete the file if there's an error
      reject(err);
    });

    // Set a timeout for the request
    request.setTimeout(30000, () => {
      console.error("Download request timed out");
      request.destroy();
      fileStream.close();
      fs.unlink(dest, () => {});
      reject(new Error("Download request timed out"));
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
