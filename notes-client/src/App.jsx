import React, { useState } from "react";

function App() {
  const [host, setHost] = useState("192.168.0.100"); // tu później wpiszesz IP serwera
  const [port, setPort] = useState(5000);
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("json");
  const [status, setStatus] = useState("");

  const filteredNotes = notes.filter((n) => {
    const q = search.toLowerCase();
    const inTitle = (n.title || "").toLowerCase().includes(q);
    const inTags = (n.tags || []).some((t) => t.toLowerCase().includes(q));
    return inTitle || inTags;
  });

  const selectedNote = selectedIndex != null ? filteredNotes[selectedIndex] : null;

  const handleConnect = async () => {
    try {
      setStatus("Łączenie...");
      const newNotes = await window.notesApi.connectAndDownload(
        host,
        Number(port),
        password
      );
      setNotes(newNotes);
      setSelectedIndex(0);
      setStatus(`Pobrano ${newNotes.length} notatek.`);
    } catch (e) {
      console.error(e);
      setStatus("Błąd połączenia: " + e.message);
    }
  };

  const handleSaveLocal = async () => {
    if (notes.length === 0) return;
    const filePath = format === "json" ? "notes_local.json" : "notes_local.xml";
    await window.notesApi.saveFile(format, notes, filePath);
    setStatus(`Zapisano plik ${filePath}`);
  };

  const handleGenerateDocs = async () => {
    await window.notesApi.generateDocs("docs.html");
    setStatus("Wygenerowano dokumentację docs.html");
  };

  const updateSelectedNoteField = (field, value) => {
    if (selectedIndex == null) return;
    const globalIndex = notes.indexOf(filteredNotes[selectedIndex]);
    const newNotes = [...notes];
    newNotes[globalIndex] = { ...newNotes[globalIndex], [field]: value };
    setNotes(newNotes);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ width: "30%", borderRight: "1px solid #ccc", padding: "1rem" }}>
        <h2>Serwer</h2>
        <div>
          <label>IP: </label>
          <input value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div>
          <label>Port: </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <div>
          <label>Hasło: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button onClick={handleConnect}>Połącz i pobierz notatki</button>

        <hr />
        <h3>Wyszukaj</h3>
        <input
          placeholder="tytuł lub tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <h3>Notatki</h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          {filteredNotes.map((n, i) => (
            <li
              key={n.title + i}
              onClick={() => setSelectedIndex(i)}
              style={{
                padding: "0.3rem",
                cursor: "pointer",
                background: i === selectedIndex ? "#eee" : "transparent",
              }}
            >
              <strong>{n.title}</strong>
              <br />
              <small>{n.created}</small>
            </li>
          ))}
        </ul>

        <hr />
        <div>
          <label>Format zapisu: </label>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
        <button onClick={handleSaveLocal}>Zapisz notatki lokalnie</button>
        <button onClick={handleGenerateDocs}>Generuj dokumentację HTML</button>

        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
          {status}
        </p>
      </div>

      <div style={{ flex: 1, padding: "1rem" }}>
        {selectedNote ? (
          <>
            <h2>Edytuj notatkę</h2>
            <div>
              <label>Tytuł: </label>
              <input
                style={{ width: "100%" }}
                value={selectedNote.title || ""}
                onChange={(e) =>
                  updateSelectedNoteField("title", e.target.value)
                }
              />
            </div>
            <div>
              <label>Data utworzenia: </label>
              <input
                style={{ width: "100%" }}
                value={selectedNote.created || ""}
                onChange={(e) =>
                  updateSelectedNoteField("created", e.target.value)
                }
              />
            </div>
            <div>
              <label>Tagi (rozdzielone przecinkami): </label>
              <input
                style={{ width: "100%" }}
                value={(selectedNote.tags || []).join(",")}
                onChange={(e) =>
                  updateSelectedNoteField(
                    "tags",
                    e.target.value.split(",").map((s) => s.trim())
                  )
                }
              />
            </div>
            <div>
              <label>Treść: </label>
              <textarea
                rows={15}
                style={{ width: "100%" }}
                value={selectedNote.body || ""}
                onChange={(e) =>
                  updateSelectedNoteField("body", e.target.value)
                }
              />
            </div>
          </>
        ) : (
          <p>Wybierz notatkę z listy po lewej.</p>
        )}
      </div>
    </div>
  );
}

export default App;
