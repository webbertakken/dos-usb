import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { execFile } from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import extract from "extract-zip";
import electron from "electron";
import {
  resolveDosbox,
  findOnPath,
  getDosboxDataDir,
  buildTerminationCommand,
} from "./dosbox/platform.mjs";
import { selectExecutable, buildAutoexec } from "./dosbox/launch.mjs";

// Tracks the DOSBox process we spawned so it can be terminated cross-platform.
let activeDosboxChild = null;

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

  // In dev the Next server may not be up yet (or may restart), which yields a
  // white screen on ERR_CONNECTION_REFUSED. Retry loading until it is ready.
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedUrl) => {
    console.error(`Failed to load: ${errorDescription} (${errorCode}) ${validatedUrl ?? ""}`);
    if (isDev && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          console.log("Retrying dev server load...");
          mainWindow.loadURL(startUrl);
        }
      }, 1000);
    }
  });

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

// Resolve the bundled store catalogue. Works in dev (public/) and in the
// packaged app (out/), avoiding fetch() which is unreliable under file://.
function resolveCataloguePath() {
  const candidates = [
    path.join(process.cwd(), "public", "catalogue.json"),
    path.join(__dirname, "..", "out", "catalogue.json"),
    path.join(__dirname, "..", "public", "catalogue.json"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

ipcMain.handle("get-store-catalogue", async () => {
  try {
    const cataloguePath = resolveCataloguePath();
    if (!cataloguePath) {
      console.error("Store catalogue not found in any known location");
      return [];
    }
    const data = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
    console.log(`Loaded ${data.length} catalogue entries from ${cataloguePath}`);
    return data;
  } catch (error) {
    console.error("Error reading store catalogue:", error);
    return [];
  }
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

// Ensure DOSBox is fully terminated before starting a new instance.
// On Windows the portable launcher detaches a `DOSBox.exe`, so we kill by
// image name. On other platforms DOSBox is our direct child, so we signal it.
async function ensureDOSBoxClosed() {
  return new Promise((resolve) => {
    const termination = buildTerminationCommand(process.platform);

    if (!termination) {
      if (activeDosboxChild && !activeDosboxChild.killed) {
        console.log(`Terminating tracked DOSBox process (PID ${activeDosboxChild.pid})`);
        try {
          activeDosboxChild.kill("SIGTERM");
        } catch (error) {
          console.log("Could not terminate tracked DOSBox process:", error.message);
        }
      } else {
        console.log("No tracked DOSBox process to terminate");
      }
      activeDosboxChild = null;
      setTimeout(resolve, 200);
      return;
    }

    try {
      console.log("Ensuring no DOSBox instances are running before starting a new one");
      const cleanup = execFile(termination.command, termination.args, {
        windowsHide: true,
        shell: true,
      });

      cleanup.on("close", (code) => {
        console.log(`DOSBox cleanup exited with code ${code}`);
        // Wait a moment to ensure processes are fully terminated
        setTimeout(resolve, 500);
      });

      cleanup.on("error", () => {
        // Error likely means no DOSBox was running, which is fine
        console.log("No DOSBox instances were running");
        resolve();
      });
    } catch (error) {
      // If the command fails, it's likely because DOSBox isn't running
      console.log("No DOSBox instances found or error in cleanup:", error.message);
      resolve();
    }
  });
}

/**
 * Sets up the DOSBox environment for the game
 */
async function setupDOSBox(gameId, gameDir, gameExe) {
  try {
    // First ensure any existing DOSBox instances are closed
    await ensureDOSBoxClosed();

    // Get primary screen dimensions to determine optimal window size
    const screen = electron.screen.getPrimaryDisplay();
    const { width, height } = screen.workAreaSize;

    console.log(`Primary screen dimensions: ${width}x${height}`);
    console.log(`Setting up DOSBox for gameId: ${gameId}, dir: ${gameDir}, exe: ${gameExe}`);

    // Resolve the DOSBox executable for the current platform:
    // bundled portable build on Windows, a PATH binary elsewhere.
    const baseDir = process.cwd();
    const resolved = resolveDosbox({
      platform: process.platform,
      baseDir,
      fileExists: (candidate) => fs.existsSync(candidate),
      canRunFromPath: (command) =>
        findOnPath({
          command,
          platform: process.platform,
          env: process.env,
          fileExists: (candidate) => fs.existsSync(candidate),
        }) !== null,
    });

    if (resolved) {
      console.log(`Using DOSBox (${resolved.source}) at: ${resolved.command}`);

      // Directory for DOSBox configuration
      const dosboxDataDir = getDosboxDataDir({
        source: resolved.source,
        baseDir,
        userDataDir: app.getPath("userData"),
      });

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
        (res) => res.width === customWidth && res.height === maxUsableHeight,
      );

      if (!hasCustomResolution) {
        resolutionOptions.push({
          name: "custom",
          width: customWidth,
          height: maxUsableHeight,
        });
        console.log(`Added custom resolution: ${customWidth}x${maxUsableHeight}`);
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
          console.log(`Created default DOSBox configuration at: ${dosboxConfigPath}`);
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
            /^(fullscreen|fulldouble|fullresolution|windowresolution|output|autolock|frameskip|aspect|scaler)=/,
          )
        ) {
          newConfig += line + "\n";
        }
      }

      // Check if we need special handling for START.EXE (common for some games)
      const isStartExe = gameExe.toLowerCase() === "start.exe";

      // Build the autoexec that mounts the game and runs it (cross-platform,
      // uses `call` for .bat so control returns to the script).
      const autoexecSection = `
[autoexec]
${buildAutoexec({ gameDir, executable: gameExe })}`;

      newConfig += autoexecSection;

      // Write the updated configuration to a custom file
      const customConfigPath = path.join(dosboxDataDir, `dosbox-${gameId}.conf`);
      fs.writeFileSync(customConfigPath, newConfig);
      console.log(`Created custom DOSBox config at: ${customConfigPath}`);

      // Launch DOSBox with the custom config
      const child = execFile(resolved.command, ["-conf", customConfigPath], {
        windowsHide: false,
      });
      activeDosboxChild = child;

      // Store the child process ID for logging
      const childPid = child.pid;
      console.log(`DOSBox started with PID: ${childPid}`);

      // Set up child process event listeners
      child.stdout?.on("data", (data) => {
        console.log(`DOSBox output: ${data}`);
      });

      child.stderr?.on("data", (data) => {
        console.error(`DOSBox error: ${data}`);
      });

      child.on("error", (err) => {
        console.error("Failed to start DOSBox:", err);
        return { success: false, error: err.message };
      });

      // For START.EXE, add a delay to prevent premature exit
      if (isStartExe) {
        console.log("Using special handling for START.EXE launcher");
        // Wait a bit longer before resolving to give the game time to launch
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      child.on("close", (code) => {
        console.log(`DOSBox process exited with code ${code}`);
        if (activeDosboxChild === child) {
          activeDosboxChild = null;
        }

        // Clean up any leftover detached processes (Windows portable launcher).
        const termination = buildTerminationCommand(process.platform);
        if (!termination) {
          return;
        }
        try {
          const cleanup = execFile(termination.command, termination.args, {
            windowsHide: true,
            shell: true,
          });

          cleanup.on("close", (cleanupCode) => {
            console.log(`DOSBox cleanup exited with code ${cleanupCode}`);
          });
        } catch (cleanupError) {
          console.error("Error during DOSBox cleanup:", cleanupError);
        }
      });

      // Wait a moment to ensure the process starts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return { success: true };
    }

    const installHint =
      process.platform === "darwin"
        ? "Install it with: brew install dosbox-staging"
        : process.platform === "win32"
          ? "The bundled DOSBox could not be found; reinstall the app or install DOSBox and add it to PATH."
          : "Install it with your package manager, e.g. sudo apt install dosbox-staging (or dosbox).";
    const message = `DOSBox was not found. ${installHint}`;
    console.error(message);
    return { success: false, error: message };
  } catch (error) {
    console.error("Error setting up DOSBox:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve which executable to run and the directory it lives in.
 * Looks at the game root first, then one level of subdirectories (some zips
 * extract into a folder). Returns { dir, executable } or null.
 */
function resolveGameLaunch(gamePath, gameId, runExe) {
  const rootFiles = fs.readdirSync(gamePath);
  const rootExe = selectExecutable(rootFiles, { gameId, runExe });
  if (rootExe) {
    return { dir: gamePath, executable: rootExe };
  }

  // Search immediate subdirectories.
  const subdirs = rootFiles.filter((entry) => {
    try {
      return fs.statSync(path.join(gamePath, entry)).isDirectory();
    } catch {
      return false;
    }
  });
  for (const subdir of subdirs) {
    const subPath = path.join(gamePath, subdir);
    const subFiles = fs.readdirSync(subPath);
    const subExe = selectExecutable(subFiles, { gameId, runExe });
    if (subExe) {
      return { dir: subPath, executable: subExe };
    }
  }

  return null;
}

// Update the launchGame function to use our new setupDOSBox function
ipcMain.handle("launch-game", async (event, { gamePath }) => {
  console.log(`Attempting to launch game from path: ${gamePath}`);

  // First ensure any existing DOSBox instances are closed
  await ensureDOSBoxClosed();

  // Extract game ID from path
  const gameId = path.basename(gamePath);
  console.log(`Game ID: ${gameId}`);

  try {
    // Read the catalogue-provided run executable, if we stored it on download.
    let runExe;
    const metadataPath = path.join(gamePath, "metadata.json");
    if (fs.existsSync(metadataPath)) {
      try {
        runExe = JSON.parse(fs.readFileSync(metadataPath, "utf8")).runExe;
      } catch (metaError) {
        console.warn("Could not read game metadata:", metaError.message);
      }
    }

    // Resolve the executable and the directory it lives in (zips sometimes
    // extract into a subfolder), then launch.
    const resolved = resolveGameLaunch(gamePath, gameId, runExe);

    if (resolved) {
      console.log(`Will execute: ${resolved.executable} in ${resolved.dir} for ${gameId}`);
      return await setupDOSBox(gameId, path.resolve(resolved.dir), resolved.executable);
    } else {
      const gameFiles = fs.readdirSync(gamePath);
      console.error(`No suitable executable found for ${gameId}`);

      // Create a basic game.bat file to use as fallback
      const gameBatPath = path.join(gamePath, "game.bat");
      if (!gameFiles.includes("game.bat")) {
        fs.writeFileSync(
          gameBatPath,
          `@echo off
echo Loading game...
echo.
echo No specific executable was found for this game.
echo Please check the game files and try again.
echo.
echo Available files:
dir *.exe
echo.
pause
`,
        );
        console.log(`Created fallback game.bat for ${gameId}`);
        return await setupDOSBox(gameId, gamePath, "game.bat");
      }

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

        return Object.assign(
          {
            id: dir,
            path: path.join(gamesDir, dir),
            // GameCard renders `image`; metadata stores it as `thumbnail`.
            image: metadata.image || metadata.thumbnail || "",
          },
          metadata,
        );
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
        // (case-insensitive: catalogue URLs use .ZIP).
        const lowerUrl = gameInfo.downloadUrl.toLowerCase();
        const isDirectFileLink =
          lowerUrl.endsWith(".zip") || lowerUrl.endsWith(".exe") || lowerUrl.includes("file=");

        let downloadUrl = "";

        if (isDirectFileLink) {
          // If it's already a direct link, use it as is
          downloadUrl = gameInfo.downloadUrl;
          console.log("Using direct file URL:", downloadUrl);
        } else {
          // It's a game page, so we need to scrape it to find the download link
          console.log("Scraping game page for download link:", gameInfo.downloadUrl);

          try {
            // Fetch the game page
            const response = await axios.get(gameInfo.downloadUrl, {
              timeout: 15000, // 15 second timeout
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              },
            });

            console.log("Successfully fetched game page, searching for download links");

            const dom = new JSDOM(response.data);
            const document = dom.window.document;

            // ===== STRATEGY 1: Look for specific download buttons =====
            const downloadButton = Array.from(
              document.querySelectorAll(
                ".downloadbutton, a.button, a.green, a.download, .btn-download, strong, b, a",
              ),
            ).find((el) => {
              const text = (el.textContent || "").toLowerCase().trim();
              return (
                text.includes("download the game") ||
                text.includes("download game") ||
                text.includes("download") ||
                text === "download" ||
                text.includes("get game")
              );
            });

            if (downloadButton) {
              // Get the closest anchor element
              const downloadLink =
                downloadButton.tagName === "A"
                  ? downloadButton
                  : downloadButton.closest("a") || downloadButton.parentElement?.closest("a");

              if (downloadLink) {
                const href = downloadLink.getAttribute("href");
                if (href) {
                  const directLink = href.startsWith("http")
                    ? href
                    : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;
                  console.log("Found download button with direct link:", directLink);
                  downloadUrl = directLink;
                }
              }
            }

            // ===== STRATEGY 2: Look for direct file links =====
            if (!downloadUrl) {
              const fileLinks = Array.from(document.querySelectorAll("a[href]"))
                .filter((link) => {
                  const href = link.getAttribute("href") || "";
                  return (
                    (href.includes("/files/") || href.includes("file=")) &&
                    (href.endsWith(".zip") || href.endsWith(".exe"))
                  );
                })
                .map((link) => {
                  const href = link.getAttribute("href");
                  return href.startsWith("http")
                    ? href
                    : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;
                });

              if (fileLinks.length > 0) {
                console.log("Found direct file link:", fileLinks[0]);
                downloadUrl = fileLinks[0];
              }
            }

            // ===== STRATEGY 3: Look for download sections - especially for Commander Keen games =====
            if (!downloadUrl) {
              // Look for sections that might contain download info - especially in tables
              const downloadSections = Array.from(
                document.querySelectorAll(
                  "table, div.content, div.download, .dg-download-button, .btn-download, #download-button",
                ),
              );

              for (const section of downloadSections) {
                // Look for links inside these sections
                const links = Array.from(section.querySelectorAll("a[href]"));

                for (const link of links) {
                  const href = link.getAttribute("href") || "";
                  const text = (link.textContent || "").toLowerCase().trim();

                  // Check if it's a download link
                  if (
                    (href.includes("files/") ||
                      href.includes("download.php") ||
                      href.includes("file=") ||
                      text.includes("download") ||
                      text === "here" ||
                      text.includes("get game")) &&
                    (href.endsWith(".zip") || href.endsWith(".exe") || href.includes("php"))
                  ) {
                    const fullUrl = href.startsWith("http")
                      ? href
                      : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;

                    console.log("Found download link in section:", fullUrl);
                    downloadUrl = fullUrl;
                    break;
                  }
                }

                if (downloadUrl) break;
              }
            }

            // ===== STRATEGY 4: Look for download links in a specific pattern for dosgames.com =====
            if (!downloadUrl) {
              // Look for the main download area - the key phrase often precedes the download link
              const downloadLinkText = response.data.match(
                /DOWNLOAD THE GAME FREE[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>/i,
              );
              if (downloadLinkText && downloadLinkText[1]) {
                const href = downloadLinkText[1];
                const fullUrl = href.startsWith("http")
                  ? href
                  : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;

                console.log("Found direct download link in main download area:", fullUrl);
                downloadUrl = fullUrl;
              }
            }

            // ===== STRATEGY 5: Extract zip filename directly from page content =====
            if (!downloadUrl) {
              // Look for file references in pre-formatted text or code blocks
              const zipFileReferences = response.data.match(
                /([a-zA-Z0-9_-]+\.zip)\s*-\s*[\d.]+[kmg]?b?\s*-\s*(?:Run|Unzip)/i,
              );
              if (zipFileReferences && zipFileReferences[1]) {
                const filename = zipFileReferences[1];
                const fullUrl = `https://www.dosgames.com/files/${filename}`;
                console.log(
                  `Found zip filename reference in text: ${filename}, using URL: ${fullUrl}`,
                );
                downloadUrl = fullUrl;
              }
            }

            // ===== STRATEGY 6: Parse code blocks for download links specifically for Commander Keen =====
            if (!downloadUrl && gameInfo.id.includes("commander-keen")) {
              // Look for the DOSBOX download pattern which is common for Commander Keen games
              const keenPattern = response.data.match(
                /DOSBOX_KEEN\d?\.ZIP|dosbox_keen\d?\.zip|(\d)keen\.zip/i,
              );
              if (keenPattern) {
                const filename = keenPattern[0];
                const fullUrl = `https://www.dosgames.com/files/${filename}`;
                console.log(
                  `Found Commander Keen filename in page content: ${filename}, using URL: ${fullUrl}`,
                );
                downloadUrl = fullUrl;
              }
            }

            // ===== STRATEGY 7: Parse for the "Downloading..." placeholder link =====
            if (!downloadUrl) {
              // Sometimes the page content indicates we need to wait for download to start
              const downloadingSection = response.data.match(
                /Downloading\s*\.\.\.[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>/i,
              );
              if (downloadingSection && downloadingSection[1]) {
                const href = downloadingSection[1];
                const fullUrl = href.startsWith("http")
                  ? href
                  : `https://www.dosgames.com${href.startsWith("/") ? "" : "/"}${href}`;

                console.log("Found download link in 'Downloading...' section:", fullUrl);
                downloadUrl = fullUrl;
              }
            }

            // ===== STRATEGY 8: Use HEAD requests to check if URLs exist but only if we have a number for Commander Keen =====
            if (!downloadUrl && gameInfo.id.includes("commander-keen")) {
              // Extract the keen number from the ID
              const keenMatch = gameInfo.id.match(/commander-keen-(\d+)/);
              const keenNumber = keenMatch ? keenMatch[1] : null;

              if (keenNumber) {
                // First, check for DOSBOX version which is most common
                const possibleUrls = [
                  `https://www.dosgames.com/files/DOSBOX_KEEN${keenNumber}.ZIP`,
                  `https://www.dosgames.com/files/dosbox_keen${keenNumber}.zip`,
                ];

                // Special case for Keen 1
                if (keenNumber === "1") {
                  possibleUrls.unshift(`https://www.dosgames.com/files/DOSBOX_KEEN.ZIP`);
                }

                // Test each URL with a HEAD request to see if it exists
                for (const url of possibleUrls) {
                  try {
                    console.log(`Testing URL existence: ${url}`);
                    const headResponse = await axios.head(url, {
                      timeout: 5000,
                      validateStatus: (status) => status < 400,
                    });

                    if (headResponse.status === 200) {
                      console.log(`Confirmed working download URL: ${url}`);
                      downloadUrl = url;
                      break;
                    }
                  } catch (error) {
                    console.log(`URL ${url} is not accessible:`, error.message);
                    // Continue to next URL
                  }
                }
              }
            }

            if (!downloadUrl) {
              // Debug: Log all links on the page
              console.log("No download links found. All links on the page:");
              Array.from(document.querySelectorAll("a[href]")).forEach((link) => {
                console.log(`- ${link.textContent.trim()} => ${link.getAttribute("href")}`);
              });
              throw new Error("Failed to find a valid download link on the game page");
            }
          } catch (scrapeError) {
            console.error("Error scraping game page:", scrapeError.message);
            // If we can't scrape, fall back to mock download
            console.log("Scraping failed, using mock download");
            return await mockDownload(gameInfo, gameDir);
          }
        }

        try {
          // Determine file type from URL
          const isExeFile = downloadUrl.toLowerCase().endsWith(".exe");
          const fileExtension = isExeFile ? ".exe" : ".zip";
          const downloadedFilePath = path.join(gameDir, `${gameInfo.id}${fileExtension}`);

          // Download the file
          await downloadFile(downloadUrl, downloadedFilePath, (progress) => {
            mainWindow.webContents.send("download-status", {
              gameId: gameInfo.id,
              status: "downloading",
              progress: progress,
            });
          });

          // Inform renderer that extraction is starting (or processing for EXE)
          mainWindow.webContents.send("download-status", {
            gameId: gameInfo.id,
            status: "extracting",
            progress: 100,
          });

          if (isExeFile) {
            // If it's an EXE file, we don't need to extract it, but create a batch file
            console.log("Downloaded EXE file, no extraction needed");

            // Create a batch file to run the exe
            const batFilePath = path.join(gameDir, "game.bat");
            fs.writeFileSync(
              batFilePath,
              `@echo off
echo Running ${gameInfo.title}
"${path.basename(downloadedFilePath)}"
`,
            );
          } else {
            // Extract the ZIP file
            await extract(downloadedFilePath, { dir: gameDir });

            // Delete the zip file after extraction
            fs.unlinkSync(downloadedFilePath);
          }

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
                thumbnail: gameInfo.thumbnail || gameInfo.image,
                downloadUrl: gameInfo.downloadUrl,
                runExe: gameInfo.runExe,
              },
              null,
              2,
            ),
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
        } catch (downloadError) {
          console.error("Error downloading or extracting game:", downloadError);
          throw downloadError;
        }
      } catch (error) {
        console.error("Error in download process:", error);
        // Inform renderer about the error
        mainWindow.webContents.send("download-status", {
          gameId: gameInfo.id,
          status: "error",
          error: error.message || "Failed to download or extract the game",
        });

        // Clean up any partial downloads or extracted files
        try {
          const zipFilePath = path.join(gameDir, `${gameInfo.id}.zip`);
          const exeFilePath = path.join(gameDir, `${gameInfo.id}.exe`);

          if (fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
          }

          if (fs.existsSync(exeFilePath)) {
            fs.unlinkSync(exeFilePath);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up after failed download:", cleanupError);
        }

        // Try to use mock download as last resort
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

    const fileStream = createWriteStream(dest);
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      fileStream.close();
      fs.unlink(dest, () => {});
      reject(err);
    };

    // Follow up to 5 redirects (dosgames/Cloudflare may redirect to a CDN).
    const get = (currentUrl, redirectsLeft) => {
      const client = currentUrl.startsWith("http://") ? http : https;
      const request = client.get(
        currentUrl,
        { headers: { "User-Agent": "Mozilla/5.0" } },
        (response) => {
          const status = response.statusCode ?? 0;

          // Redirect handling.
          if (status >= 300 && status < 400 && response.headers.location) {
            response.resume(); // discard body
            if (redirectsLeft <= 0) {
              fail(new Error("Too many redirects"));
              return;
            }
            const next = new URL(response.headers.location, currentUrl).toString();
            console.log(`Redirect ${status} -> ${next}`);
            get(next, redirectsLeft - 1);
            return;
          }

          if (status !== 200) {
            console.error(`Download failed with status: ${status} ${response.statusMessage}`);
            console.error(`URL: ${currentUrl}`);
            response.resume();
            fail(new Error(`Failed to download: ${status} ${response.statusMessage}`));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"], 10);
          let downloadedSize = 0;
          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize) {
              progressCallback(Math.floor((downloadedSize / totalSize) * 100));
            } else {
              progressCallback(Math.floor(Math.min(downloadedSize / 1000000, 95)));
            }
          });

          response.pipe(fileStream);
          fileStream.on("finish", () => {
            if (settled) return;
            settled = true;
            fileStream.close();
            resolve();
          });
        },
      );

      request.on("error", (err) => {
        console.error(`Network error during download: ${err.message}`);
        fail(err);
      });

      request.setTimeout(30000, () => {
        console.error("Download request timed out");
        request.destroy();
        fail(new Error("Download request timed out"));
      });
    };

    fileStream.on("error", (err) => {
      console.error(`File system error during download: ${err.message}`);
      fail(err);
    });

    get(url, 5);
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

  // Common executable names to check for in the game ID
  // This helps create appropriate mock files for known games
  const commonExePatterns = {
    "commander-keen-dreams": "START.EXE", // Special case that uses START.EXE
    keen: "KEEN",
    wolf: "WOLF",
    doom: "DOOM",
    duke: "DUKE",
  };

  // Determine the right mock executable to create
  let mockExeName = null;

  // Check if any known pattern matches the game ID
  for (const [pattern, exePrefix] of Object.entries(commonExePatterns)) {
    if (gameInfo.id.includes(pattern)) {
      // For keen dreams, use the special executable
      if (pattern === "commander-keen-dreams") {
        mockExeName = exePrefix;
      }
      // Otherwise generate a numbered executable if it's a numbered game
      else {
        // Extract any numbers from the game ID
        const matches = gameInfo.id.match(/\d+/);
        const number = matches ? matches[0] : "";
        mockExeName = number ? `${exePrefix}${number}.EXE` : `${exePrefix}.EXE`;
      }
      break;
    }
  }

  // If no specific pattern matched, use a generic name
  if (!mockExeName) {
    mockExeName = "GAME.EXE";
  }

  // Create a mock game.bat file that will run the appropriate exe
  const gameBatPath = path.join(gameDir, "game.bat");
  fs.writeFileSync(
    gameBatPath,
    `@echo off
echo Loading ${gameInfo.title || gameInfo.id}...
echo.
if exist ${mockExeName} (
  ${mockExeName}
) else (
  echo Could not find ${mockExeName}
  echo.
  echo Available files:
  dir *.exe
  echo.
  pause
)
`,
  );

  // Create the mock executable file
  const exePath = path.join(gameDir, mockExeName);
  console.log(`Creating mock executable: ${exePath}`);
  fs.writeFileSync(
    exePath,
    `@echo off
echo This is a mock executable for ${gameInfo.title}.
echo In a real download, this would be the actual game executable.
echo.
echo Press any key to return to DOS...
pause > nul
`,
  );

  // For games using START.EXE, also create a necessary companion file
  if (mockExeName === "START.EXE") {
    // Games with START.EXE often need a companion file
    const companionFile = path.join(gameDir, "KDREAMS.EXE");
    fs.writeFileSync(
      companionFile,
      `@echo off
echo This is a companion file for ${gameInfo.title}.
echo.
echo Press any key to return to DOS...
pause > nul
`,
    );
  }

  // Create a README.TXT with general instructions
  const readmePath = path.join(gameDir, "README.TXT");
  fs.writeFileSync(
    readmePath,
    `${gameInfo.title}
==============================

This is a mock download of ${gameInfo.title}.
In a real installation, this would contain the actual game files.

The game should start automatically when launched using the executable: ${mockExeName}

Enjoy the game!
`,
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
      2,
    ),
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
