import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
 
//ustawienia ścieżek
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
//szyfrowanie
function deriveBaseKey(password) {
  let baseKey = 0;
  for (let i = 0; i < password.length; i++) {
    baseKey = (baseKey + password.charCodeAt(i)) % 256;
  }
  return baseKey;
}
 
function encryptBody(plainText, password) {
  const baseKey = deriveBaseKey(password);
  let result = "";
  for (let i = 0; i < plainText.length; i++) {
    const c = plainText.charCodeAt(i);
    const k = (baseKey + i * 31) % 256;
    let b = c ^ k;
    b = (b + 3) % 256;
    result += b.toString(16).padStart(2, "0");
  }
  return result;
}
 
//ramki
function buildFrame(type, payloadStr) {
  const payloadBuf = Buffer.from(payloadStr, "utf8");
  const len = payloadBuf.length;
  const lenHi = (len >> 8) & 0xff; // BIG-ENDIAN
  const lenLo = len & 0xff;
  const header = Buffer.from([lenHi, lenLo, type]);
  return Buffer.concat([header, payloadBuf]);
}
 
//wczytywanie notatek
function loadNotesJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const txt = fs.readFileSync(filePath, "utf8");
  if (!txt.trim()) return [];
  return JSON.parse(txt); // tablica notatek
}
 
const PORT = parseInt(process.argv[2] || "5000", 10);
const PASSWORD = process.argv[3] || "secret";
 
const notesPath = path.join(__dirname, "notes.json");
let notes = loadNotesJson(notesPath);
 
// zaszyfruj body jeśli nie jest zaszyfrowane
notes = notes.map((n) => {
  if (!n.encrypted) {
    n.body = encryptBody(n.body || "", PASSWORD);
    n.encrypted = true;
  }
  return n;
});
 
// zapisz z powrotem zaszyfrowane
fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), "utf8");
 
const server = net.createServer((socket) => {
  console.log("Client connected:", socket.remoteAddress, socket.remotePort);
 
  // komunikat startowy
  socket.write(buildFrame(0x02, "START_NOTES_STREAM"));
 
  for (const note of notes) {
    const payload = JSON.stringify(note);
    const frame = buildFrame(0x01, payload);
    socket.write(frame);
  }
 
  // ramka kończąca
  socket.write(buildFrame(0xff, "END"));
  socket.end();
});
 
server.listen(PORT, () => {
  console.log(`Notes server listening on port ${PORT}`);
  console.log("Usage: node server.js <port> <password>");
});