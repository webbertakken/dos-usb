const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  launchGame: (gamePath) => ipcRenderer.invoke("launch-game", gamePath),
  getGames: () => ipcRenderer.invoke("get-games"),
  saveGameMetadata: (gameId, metadata) => ipcRenderer.invoke("save-game-metadata", { gameId, metadata }),
});
