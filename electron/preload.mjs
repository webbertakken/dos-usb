import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  launchGame: (gamePath) => {
    if (typeof gamePath === "string") {
      return ipcRenderer.invoke("launch-game", { gamePath });
    }
    return Promise.reject(new Error("Invalid game path"));
  },
  getGames: () => ipcRenderer.invoke("get-games"),
  saveGameMetadata: (gameId, metadata) => {
    if (
      typeof gameId === "string" &&
      metadata &&
      typeof metadata === "object"
    ) {
      return ipcRenderer.invoke("save-game-metadata", { gameId, metadata });
    }
    return Promise.reject(new Error("Invalid arguments"));
  },
  downloadGame: (gameInfo) => {
    if (
      gameInfo &&
      typeof gameInfo === "object" &&
      gameInfo.id &&
      gameInfo.downloadUrl
    ) {
      return ipcRenderer.invoke("download-game", gameInfo);
    }
    return Promise.reject(new Error("Invalid game information"));
  },
  onDownloadStatus: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners("download-status");

    // Add new listener
    ipcRenderer.on("download-status", (_, status) => {
      callback(status);
    });

    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeAllListeners("download-status");
    };
  },
  logError: (error) => ipcRenderer.invoke("log-error", error),
});
