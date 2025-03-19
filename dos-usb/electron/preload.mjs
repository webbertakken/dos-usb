import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  launchGame: (gamePath) => {
    if (typeof gamePath === "string") {
      return ipcRenderer.invoke("launch-game", gamePath);
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
  logError: (error) => ipcRenderer.invoke("log-error", error),
});
