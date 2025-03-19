import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import fs from "fs";

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
