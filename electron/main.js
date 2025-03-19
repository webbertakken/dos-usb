const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const startUrl = isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../out/index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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
        let metadata = { title: dir, description: "", year: "", category: "", thumbnail: "" };

        if (fs.existsSync(metadataPath)) {
          try {
            metadata = { ...metadata, ...JSON.parse(fs.readFileSync(metadataPath, "utf8")) };
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
