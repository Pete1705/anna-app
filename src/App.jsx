import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { bootstrapAnna } from "./anna/bootstrap";
import { loadMemory, upsertMemoryItems, resetAnnaStorage, fetchMemoryFromBackend } from "./anna/memory";
import { parseRememberCommand, executeRememberCommand } from "./anna/commands";
import { suggestMemoryFromText } from "./anna/nlpMemory";

export default function App() {
  const [boot, setBoot] = useState(null);
  const [mem, setMem] = useState(null);
  const [err, setErr] = useState("");

  // Form state
  const [type, setType] = useState("preference");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState("high");

  // Chat MVP
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);

  // Natural-language memory suggestions
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const b = await bootstrapAnna();
        setBoot(b);
        setMem(loadMemory());
        document.title = `ANNA ✅ ${b.sessionId.slice(0, 8)}`;
      } catch (e) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  const itemsSorted = useMemo(() => {
    const items = mem?.items || [];
    return [...items].sort((a, b) => {
      const ak = `${a.type}:${a.key}`.toLowerCase();
      const bk = `${b.type}:${b.key}`.toLowerCase();
      return ak.localeCompare(bk);
    });
  }, [mem]);

  function addMessage(role, text) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, role, text },
    ]);
  }

  async function refreshMemory() {
    try {
      setErr("");
      await fetchMemoryFromBackend();
      setMem(loadMemory());
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function handleRemember() {
    const k = key.trim();
    const v = value.trim();
    if (!k || !v) return;

    try {
      setErr("");
      await upsertMemoryItems([{ type, key: k, value: v, confidence }]);
      setKey("");
      setValue("");
      setMem(loadMemory());
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  function handleReset() {
    resetAnnaStorage();
    window.location.reload();
  }

  async function handleSendChat() {
    const text = chatInput.trim();
    if (!text) return;

    addMessage("user", text);

    // 1) explicit command path
    const parsed = parseRememberCommand(text);
    if (parsed) {
      try {
        setErr("");
        await executeRememberCommand(parsed); // this calls upsert (backend) now
        setMem(loadMemory());
        addMessage("anna", `✅ Gemerkt: ${parsed.type}:${parsed.key} = "${parsed.value}" (@${parsed.confidence})`);
      } catch (e) {
        setErr(String(e?.message || e));
        addMessage("anna", `❌ Fehler beim Merken: ${String(e?.message || e)}`);
      }
      setSuggestions([]);
      setChatInput("");
      return;
    }

    // 2) natural-language suggestion path
    const sug = suggestMemoryFromText(text);
    setSuggestions(sug);

    if (sug.length > 0) {
      addMessage("anna", `Ich glaube, da steckt eine Präferenz drin. Soll ich mir das merken? (siehe Vorschläge unten)`);
    } else {
      addMessage("anna", "👀 (MVP) Kein Memory-Command erkannt. Wenn du willst: „merk dir: key = value“.");
    }

    setChatInput("");
  }

  async function applySuggestion(s) {
    try {
      setErr("");
      await upsertMemoryItems([{ type: s.type, key: s.key, value: s.value, confidence: s.confidence }]);
      setMem(loadMemory());
      addMessage("anna", `✅ Gemerkt (Vorschlag): ${s.type}:${s.key} = "${s.value}" (@${s.confidence})`);
      setSuggestions((prev) => prev.filter((x) => !(x.type === s.type && x.key === s.key)));
    } catch (e) {
      setErr(String(e?.message || e));
      addMessage("anna", `❌ Fehler beim Merken: ${String(e?.message || e)}`);
    }
  }

  function ignoreSuggestion(s) {
    addMessage("anna", `❌ Okay, ich merke mir ${s.type}:${s.key} nicht.`);
    setSuggestions((prev) => prev.filter((x) => !(x.type === s.type && x.key === s.key)));
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 8 }}>ANNA – Text & Sprache + Memory + Cloud Voice</h2>

      {err && (
        <div style={{ border: "1px solid #a33", background: "#2a1010", padding: 10, borderRadius: 10, marginBottom: 12 }}>
          <b>Backend/Memory Error:</b> {err}
        </div>
      )}

      {/* BOOT PANEL */}
      <div style={{ border: "1px solid #444", borderRadius: 12, padding: 12, marginBottom: 14, background: "#111" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>✅ Boot-Status (Backend)</div>

        {!boot ? (
          <div>Boot läuft… (lädt Memory vom Backend)</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div><b>sessionId:</b> {boot.sessionId}</div>
            <div><b>memoryId:</b> {boot.memoryId}</div>
            <div><b>memoryVersion:</b> {boot.memoryVersion}</div>
            <div><b>items:</b> {mem?.items?.length ?? 0}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={refreshMemory}>🔄 Refresh (Backend)</button>
          <button onClick={handleReset} style={{ opacity: 0.9 }}>🧨 Reset (löscht anna.*)</button>
        </div>
      </div>

      {/* CHAT MVP */}
      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>💬 Chat (MVP) + Natural Memory</div>

        <div style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 10, height: 180, overflow: "auto", background: "#0f0f0f", marginBottom: 10 }}>
          {messages.length === 0 ? (
            <div style={{ opacity: 0.7 }}>
              Tipp: Schreib normal („Bitte Schritt für Schritt…“) oder explizit:
              <br />
              <code>merk dir: preference tone = Schritt-für-Schritt</code>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <b style={{ opacity: 0.8 }}>{m.role}:</b> {m.text}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder='z.B. "Bitte Schritt für Schritt" oder "merk dir: tone = Schritt-für-Schritt"'
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
          />
          <button onClick={handleSendChat}>Senden</button>
        </div>
      </div>

      {/* SUGGESTIONS */}
      {suggestions.length > 0 && (
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>✨ Vorschläge zum Merken</div>

          <div style={{ display: "grid", gap: 8 }}>
            {suggestions.map((s) => (
              <div key={`${s.type}:${s.key}`} style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 10, background: "#0f0f0f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>{s.type}:{s.key}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{s.confidence}</div>
                </div>
                <div style={{ marginTop: 6 }}>{s.value}</div>
                <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>Grund: {s.reason}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={() => applySuggestion(s)}>✅ Merken</button>
                  <button onClick={() => ignoreSuggestion(s)} style={{ opacity: 0.9 }}>❌ Ignorieren</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANUAL REMEMBER FORM */}
      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>🧠 „Merk dir …“ (Backend Upsert)</div>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
          <label style={{ alignSelf: "center" }}>Typ</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="user">user</option>
            <option value="project">project</option>
            <option value="preference">preference</option>
          </select>

          <label style={{ alignSelf: "center" }}>Key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder='z.B. "tone" oder "project_status"' />

          <label style={{ alignSelf: "center" }}>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder='z.B. "Schritt-für-Schritt"' />

          <label style={{ alignSelf: "center" }}>Confidence</label>
          <select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="high">high</option>
            <option value="medium">medium</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={handleRemember} disabled={!key.trim() || !value.trim()}>✅ Speichern</button>
          <button onClick={() => { setType("preference"); setKey(""); setValue(""); setConfidence("high"); }} style={{ opacity: 0.9 }}>
            ✨ Leeren
          </button>
        </div>
      </div>

      {/* MEMORY LIST */}
      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>📦 Memory Items (aus Cache, per Refresh vom Backend)</div>

        {!mem ? (
          <div>Memory lädt…</div>
        ) : itemsSorted.length === 0 ? (
          <div>Keine Items vorhanden.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {itemsSorted.map((it) => (
              <div key={`${it.type}:${it.key}`} style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 10, background: "#0f0f0f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>{it.type}:{it.key}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{it.confidence}</div>
                </div>
                <div style={{ marginTop: 6 }}>{it.value}</div>
                <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>updated: {it.lastUpdated}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>
        Jetzt ist das Memory backend-persistent. Test: Browser-Reset (anna.* löschen) -> Reload -> Memory kommt wieder vom Backend.
      </div>
    </div>
  );
}
