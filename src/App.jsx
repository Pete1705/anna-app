import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { bootstrapAnna } from "./anna/bootstrap";
import { loadMemory, upsertMemoryItems, resetAnnaStorage } from "./anna/memory";
import { suggestMemoryFromText } from "./anna/nlpMemory";

// --- Minimal UI Helpers ---
function sortItems(items) {
  return [...items].sort((a, b) => {
    const t = (a.type || "").localeCompare(b.type || "");
    if (t !== 0) return t;
    return (a.key || "").localeCompare(b.key || "");
  });
}

export default function App() {
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState("");
  const [input, setInput] = useState("");

  // ✅ IMPORTANT: mem is an object, not a Promise
  const [mem, setMem] = useState({ memoryId: "—", version: 0, items: [] });

  const [isBooting, setIsBooting] = useState(false);
  const [saving, setSaving] = useState(false);

  const itemsSorted = useMemo(() => sortItems(mem.items || []), [mem.items]);

  async function refreshMemoryOnly() {
    const m = await loadMemory();
    setMem(m);
  }

  async function doBoot() {
    setIsBooting(true);
    setBootError("");
    try {
      const res = await bootstrapAnna();
      setBoot(res);

      // ✅ IMPORTANT: await
      const m = await loadMemory();
      setMem(m);
    } catch (e) {
      setBootError(String(e?.message || e));
    } finally {
      setIsBooting(false);
    }
  }

  useEffect(() => {
    doBoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSend() {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setSaving(true);
    setBootError("");

    try {
      // NLP Vorschlag
      const suggestion = suggestMemoryFromText(text);

      if (!suggestion) {
        // kein Memory erkannt -> nur re-load (await!)
        await refreshMemoryOnly();
        return;
      }

      const patch = [
        {
          type: suggestion.type,
          key: suggestion.key,
          value: suggestion.value,
          confidence: suggestion.confidence || "high",
        },
      ];

      await upsertMemoryItems(patch);

      // ✅ Reload memory after upsert
      await refreshMemoryOnly();
    } catch (e) {
      setBootError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function onRefreshBackend() {
    await doBoot();
  }

  async function onReset() {
    setBootError("");
    setSaving(false);
    setInput("");

    try {
      // reset on backend + localStorage (function handles localStorage cleanup)
      await resetAnnaStorage();
    } catch (e) {
      // even if reset fails, we still try to re-boot
      setBootError(String(e?.message || e));
    } finally {
      setBoot(null);
      setMem({ memoryId: "—", version: 0, items: [] });
      await doBoot();
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18 }}>
      <h1 style={{ marginBottom: 14 }}>ANNA – Text & Sprache + Memory + Cloud Voice</h1>

      {bootError ? (
        <div
          style={{
            background: "#5c1515",
            border: "1px solid #9b2b2b",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          Backend/Memory Error: {bootError}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>✅ Boot-Status (Backend)</div>

        <div style={{ opacity: 0.9, marginBottom: 10 }}>
          {isBooting ? "Boot läuft… (lädt Memory vom Backend)" : "Boot OK."}
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 13, opacity: 0.9 }}>
          sessionId: {boot?.sessionId || "—"}
          <br />
          memoryId: {mem?.memoryId || "—"}
          <br />
          memoryVersion: {mem?.version ?? "—"}
          <br />
          items: {mem?.items?.length ?? 0}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={onRefreshBackend} disabled={isBooting}>
            Refresh (Backend)
          </button>
          <button onClick={onReset} style={{ opacity: 0.9 }} disabled={isBooting}>
            Reset (löscht anna.*)
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>💬 Chat (MVP) + Natural Memory</div>

        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 8 }}>
          Tipp: Schreib normal („Bitte Schritt für Schritt…“) oder explizit:{" "}
          <span style={{ fontFamily: "monospace" }}>merk dir: preference tone = Schritt-für-Schritt</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='z.B. "merk dir: preference tone = Schritt-für-Schritt"'
            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #444" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
          />
          <button onClick={onSend} disabled={saving}>
            {saving ? "Speichere…" : "Senden"}
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>🧠 Memory Items</div>

        {itemsSorted.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Keine Items vorhanden.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {itemsSorted.map((it) => (
              <div
                key={`${it.type}:${it.key}`}
                style={{ border: "1px solid #333", borderRadius: 12, padding: 10 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>
                    {it.type}:{it.key}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{it.confidence}</div>
                </div>
                <div style={{ marginTop: 6 }}>{it.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ opacity: 0.65, fontSize: 12 }}>
        Hinweis: Backend ist Render. Frontend läuft als Static Site.
      </div>
    </div>
  );
}
