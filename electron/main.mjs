import { app, BrowserWindow, ipcMain, net, protocol, session } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import isDev from "electron-is-dev";
import { execFile } from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import extract from "extract-zip";
import electron from "electron";
import { resolveDosbox, findOnPath, buildTerminationCommand } from "./dosbox/platform.mjs";
import { selectExecutable, buildAutoexec } from "./dosbox/launch.mjs";
import { generateDosboxConf, mergeDosboxConf } from "./dosbox/conf.mjs";
import { resolveArchiveDownload } from "./download/archiveOrg.mjs";
import { createImageCacheHandler, IMAGE_CACHE_SCHEME } from "./imageCache/imageCache.mjs";
import {
  APP_ORIGIN,
  APP_SCHEME,
  APP_SCHEME_PRIVILEGES,
  createStaticExportHandler,
} from "./protocol/staticExport.mjs";
import { buildContentSecurityPolicy } from "./protocol/contentSecurityPolicy.mjs";
import { resolvePortableRoot } from "./portable/root.mjs";

// Tracks the DOSBox process we spawned so it can be terminated cross-platform.
let activeDosboxChild = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Games (and the Windows DOSBox bundle) live beside the app, wherever it was
// put - not in the working directory, which depends on how it was started.
const portableRoot = resolvePortableRoot({
  isPackaged: !isDev,
  platform: process.platform,
  env: process.env,
  execPath: process.execPath,
  cwd: process.cwd(),
});
const gamesDir = path.join(portableRoot, "games");
console.log(`Portable root: ${portableRoot} (games in ${gamesDir})`);

// The packaged renderer loads from app://dos-usb/, not file://, so the static
// export's absolute asset paths and routes resolve. Must precede `ready`.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: APP_SCHEME_PRIVILEGES },
  { scheme: IMAGE_CACHE_SCHEME, privileges: { standard: true, secure: true } },
]);

const isFile = (candidate) => {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
};

/** Serve `out/` (inside app.asar when packaged) on app://dos-usb/. */
function serveStaticExport() {
  const root = path.join(__dirname, "..", "out");
  protocol.handle(
    APP_SCHEME,
    createStaticExportHandler({
      root,
      isFile,
      readText: (filePath) => fs.promises.readFile(filePath, "utf8"),
      fetchFile: (filePath) => net.fetch(pathToFileURL(filePath).href),
      log: console,
    }),
  );
  console.log(`[app protocol] serving ${root} on ${APP_ORIGIN}/`);
}

function createWindow() {
  // The dev server's documents get the permissive dev policy here; packaged
  // documents carry their own hash-based policy from the app:// handler.
  if (isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [buildContentSecurityPolicy({ isDev: true })],
        },
      });
    });
  }

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

  const startUrl = isDev ? "http://localhost:3000" : `${APP_ORIGIN}/`;

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

// Resolve the bundled store catalogue: public/ in dev (fresh from the
// scraper), out/ in the packaged app (public/ is not packaged).
function resolveCataloguePath() {
  const candidates = [
    path.join(__dirname, "..", "public", "catalogue.json"),
    path.join(__dirname, "..", "out", "catalogue.json"),
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

function resolveLibraryPath() {
  const candidates = [
    path.join(__dirname, "..", "public", "library.json"),
    path.join(__dirname, "..", "out", "library.json"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

ipcMain.handle("get-library", async () => {
  try {
    const libraryPath = resolveLibraryPath();
    if (!libraryPath) {
      console.error("Library not found in any known location");
      return [];
    }
    const data = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
    console.log(`Loaded ${data.length} library games from ${libraryPath}`);
    return data;
  } catch (error) {
    console.error("Error reading library:", error);
    return [];
  }
});

app.whenReady().then(() => {
  if (!isDev) serveStaticExport();
  // Store-seen screenshots live beside the games, so they travel on the stick.
  protocol.handle(
    IMAGE_CACHE_SCHEME,
    createImageCacheHandler({
      cacheDir: path.join(portableRoot, "image-cache"),
      fetchImage: (url) => net.fetch(url),
      log: console,
    }),
  );
  createWindow();
});

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

/** The per-game override, hand-written beside metadata.json; never written by the app. */
const DOSBOX_OVERRIDE_FILE = "dosbox.conf";
/** The config the last launch ran with: generated, then overridden. */
const DOSBOX_LAUNCH_FILE = "dosbox.generated.conf";

/** The override's text, or null when the game has none. */
function readOverrideConf(overridePath) {
  try {
    return fs.readFileSync(overridePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function logOverride({ gameId, overridePath, overrideConfig, launchConfig }) {
  if (overrideConfig === null) {
    console.log(`No DOSBox override for ${gameId} (${overridePath} absent)`);
    return;
  }
  const applied = launchConfig.applied.length > 0 ? launchConfig.applied.join(", ") : "nothing";
  console.log(`Applied DOSBox override for ${gameId} from ${overridePath}: ${applied}`);
  for (const line of launchConfig.ignored) {
    console.warn(`Ignored DOSBox override line for ${gameId}: ${line}`);
  }
}

/**
 * Sets up the DOSBox environment for the game. gameRoot is games/<id>;
 * gameDir is the folder mounted as C: (gameRoot or a subfolder of it).
 */
async function setupDOSBox({ gameId, gameRoot, gameDir, gameExe }) {
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
    const baseDir = portableRoot;
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

      // The launch config lives on the stick beside the game, never on the
      // host. games/<id>/dosbox.conf, when present, is laid over it; the app
      // never writes that file.
      const isStartExe = gameExe.toLowerCase() === "start.exe";
      const generatedConfig = generateDosboxConf({
        window: preferredResolution,
        autoexec: buildAutoexec({ gameDir, executable: gameExe }),
      });
      const overridePath = path.join(gameRoot, DOSBOX_OVERRIDE_FILE);
      const overrideConfig = readOverrideConf(overridePath);
      const launchConfig = mergeDosboxConf(generatedConfig, overrideConfig ?? "");
      logOverride({ gameId, overridePath, overrideConfig, launchConfig });

      const customConfigPath = path.join(gameRoot, DOSBOX_LAUNCH_FILE);
      fs.writeFileSync(customConfigPath, launchConfig.text);
      console.log(`Wrote DOSBox launch config for ${gameId}: ${customConfigPath}`);

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
      return await setupDOSBox({
        gameId,
        gameRoot: path.resolve(gamePath),
        gameDir: path.resolve(resolved.dir),
        gameExe: resolved.executable,
      });
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
        return await setupDOSBox({
          gameId,
          gameRoot: path.resolve(gamePath),
          gameDir: path.resolve(gamePath),
          gameExe: "game.bat",
        });
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
    const gamePath = path.join(gamesDir, gameId);
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
  let gameDir;
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

    await mkdir(gamesDir, { recursive: true });

    // Create directory for this specific game
    gameDir = path.join(gamesDir, gameInfo.id);
    await mkdir(gameDir, { recursive: true });

    if (gameInfo.downloadUrl.startsWith("http")) {
      // This is likely a dosgames.com page URL, not a direct file link
      console.log("Processing URL:", gameInfo.downloadUrl);

      try {
        // Import the required modules for web scraping
        const { default: axios } = await import("axios");
        const { JSDOM } = await import("jsdom");

        // Internet Archive items name their zip themselves: read it from the
        // item's metadata instead of trusting the URL's file name.
        const archiveZipUrl = await resolveArchiveDownload(
          gameInfo.downloadUrl,
          async (url) => (await axios.get(url, { timeout: 30000 })).data,
        );
        if (archiveZipUrl) {
          console.log("Resolved Internet Archive download:", archiveZipUrl);
        }
        const requestedUrl = archiveZipUrl ?? gameInfo.downloadUrl;

        // Check if the URL points to a game page or directly to a file
        // (case-insensitive: catalogue URLs use .ZIP).
        const lowerUrl = requestedUrl.toLowerCase();
        const isDirectFileLink =
          lowerUrl.endsWith(".zip") || lowerUrl.endsWith(".exe") || lowerUrl.includes("file=");

        let downloadUrl = "";

        if (isDirectFileLink) {
          // If it's already a direct link, use it as is
          downloadUrl = requestedUrl;
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
            throw scrapeError;
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

        removeIfEmpty(gameDir);
        return { success: false, error: error.message || "Failed to download or extract the game" };
      }
    } else {
      throw new Error(`Unsupported download URL: ${gameInfo.downloadUrl}`);
    }
  } catch (error) {
    console.error("Download failed:", error);

    // Inform renderer about the error
    mainWindow.webContents.send("download-status", {
      gameId: gameInfo.id,
      status: "error",
      error: error.message,
    });

    if (gameDir) {
      removeIfEmpty(gameDir);
    }
    return { success: false, error: error.message };
  }
});

// A failed download leaves no empty game folder behind (it would list as a
// game); a folder that already holds an installed game is kept.
function removeIfEmpty(dir) {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch (error) {
    console.error(`Could not remove empty game folder ${dir}:`, error);
  }
}

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
