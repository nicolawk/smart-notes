// electron/preload.js - CommonJS

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  connectAndDownload: (host, port, password) =>
    ipcRenderer.invoke("notes-connect-and-download", { host, port, password }),

  saveFile: (format, notes, filePath) =>
    ipcRenderer.invoke("notes-save-file", { format, notes, filePath }),

  generateDocs: (outputPath) =>
    ipcRenderer.invoke("notes-generate-docs", { outputPath }),
});
