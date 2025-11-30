// electron/main.js - CommonJS

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");

// --- parser ramek 4P ---

class FrameStreamParser {
  constructor(onFrame) {
    this.buffer = Buffer.alloc(0);
    this.onFrame = onFrame;
  }
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 3) {
      const lenHi = this.buffer[0];
      const lenLo = this.buffer[1];
      const type = this.buffer[2];
      const len = (lenHi << 8) | lenLo; // BIG-ENDIAN
      if (this.buffer.length < 3 + len) return;
      const payloadBuf = this.buffer.slice(3, 3 + len);
      const payloadStr = payloadBuf.toString("utf8");
      this.buffer = this.buffer.slice(3 + len);
      this.onFrame(type, payloadStr);
    }
  }
}

// --- szyfrowanie / deszyfrowanie ---

function deriveBaseKey(password) {
  let baseKey = 0;
  for (let i = 0; i < password.length; i++) {
    baseKey = (baseKey + password.charCodeAt(i)) % 256;
  }
  return baseKey;
}

function decryptBody(cipherHex, password) {
  const baseKey = deriveBaseKey(password);
  let result = "";
  const byteCount = cipherHex.length / 2;
  for (let i = 0; i < byteCount; i++) {
    const hexByte = cipherHex.substr(i * 2, 2);
    let b = parseInt(hexByte, 16);
    b = (b - 3 + 256) % 256;
    const k = (baseKey + i * 31) % 256;
    const c = b ^ k;
    result += String.fromCharCode(c);
  }
  return result;
}

// --- tworzenie okna ---

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // dev: Vite działa na 5173
  win.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  createWindow();
});

// --- IPC: połączenie z serwerem notatek ---

ipcMain.handle("notes-connect-and-download", async (event, { host, port, password }) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const notes = [];
    const parser = new FrameStreamParser((type, payload) => {
      if (type === 0x01) {
        const note = JSON.parse(payload);
        if (note.encrypted && typeof note.body === "string") {
          note.body = decryptBody(note.body, password);
          note.encrypted = false;
        }
        notes.push(note);
      } else if (type === 0xff) {
        client.end();
        resolve(notes);
      }
    });

    client.connect(port, host, () => {
      console.log("connected to server");
    });

    client.on("data", (data) => parser.push(data));
    client.on("error", (err) => reject(err));
    client.on("close", () => {
      console.log("connection closed");
    });
  });
});

// --- zapisywanie notatek (JSON / XML) ---

ipcMain.handle("notes-save-file", async (event, { format, notes, filePath }) => {
  let content = "";
  if (format === "json") {
    content = JSON.stringify(notes, null, 2);
  } else if (format === "xml") {
    const escape = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const notesXml = notes
      .map((n) => {
        const tagsXml = (n.tags || [])
          .map((t) => `<tag>${escape(t)}</tag>`)
          .join("");
        return `
<note version="${n.version || 1}" encrypted="${n.encrypted ? "true" : "false"}">
  <title>${escape(n.title || "")}</title>
  <created>${escape(n.created || "")}</created>
  <tags>${tagsXml}</tags>
  <body>${escape(n.body || "")}</body>
</note>`;
      })
      .join("\n");
    content = `<notes>\n${notesXml}\n</notes>\n`;
  }

  fs.writeFileSync(filePath, content, "utf8");
  return true;
});

// --- generowanie dokumentacji HTML ---

ipcMain.handle("notes-generate-docs", async (event, { outputPath }) => {
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Dokumentacja aplikacji Notatki</title>
<style>
body { font-family: Cambria, serif; margin: 2rem; background:#f7f7f7; color:#222; }
h1, h2 { border-bottom: 1px solid #ccc; padding-bottom: .2rem; }
code { background:#eee; padding:2px 4px; border-radius:3px; }
.section { margin-bottom: 1.5rem; }
</style>
</head>
<body>
<h1>Dokumentacja aplikacji Notatki</h1>

<div class="section">
<h2>Architektura</h2>
<p>Aplikacja składa się z programu serwera (Node.js, TCP) oraz klienta desktopowego (Electron + React).
Serwer przechowuje zaszyfrowane notatki w pliku JSON/XML i udostępnia je strumieniowo w protokole 4P-Frame.
Klient łączy się z serwerem, odbiera ramki, odszyfrowuje notatki i prezentuje je w GUI.</p>
</div>

<div class="section">
<h2>Protokół 4P-Frame</h2>
<p>Każda ramka ma postać: [LEN_HI][LEN_LO][TYPE][PAYLOAD...], gdzie długość jest zakodowana w Big-Endian,
TYPE określa typ ramki (0x01 – notatka, 0x02 – komunikat, 0x03 – błąd, 0xFF – koniec strumienia),
a PAYLOAD zawiera tekstową reprezentację notatki w formacie JSON lub XML.</p>
</div>

<div class="section">
<h2>Szyfrowanie</h2>
<p>Treść notatki (pole <code>body</code>) jest szyfrowana prostym algorytmem opartym o XOR i przesunięcie Cezara.
Z hasła użytkownika wyliczany jest bajt bazowy, a następnie każdy znak jest mieszany z kluczem zależnym od indeksu.</p>
</div>

<div class="section">
<h2>Format notatki</h2>
<p>Struktura notatki w JSON:</p>
<pre>{
  "title": "Tytuł notatki",
  "created": "RRRR-MM-DD HH:MM:SS",
  "encrypted": true,
  "body": "zaszyfrowana treść",
  "tags": ["tag1", "tag2"],
  "version": 1
}</pre>
</div>

</body>
</html>`;
  fs.writeFileSync(outputPath, html, "utf8");
  return true;
});
