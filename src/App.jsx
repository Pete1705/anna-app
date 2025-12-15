import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { bootstrapAnna } from "./anna/bootstrap";
import {
  loadMemory,
  upsertMemoryItems,
  resetAnnaStorage,
} from "./anna/memory";

import { suggestMemoryFromText } from "./anna/nlpMemory";

/* ===============================
   Kleine UI-Helfer
================================ */

function sortItems(items) {
  return [...items].sort((a, b) => {
    const t = (a.type || "").localeCompare(b.type || "");
    if (t !== 0) return t;
    return (a.key || "").localeCompare(b.key || "");
  });
}

function Toast({ text, type = "info", onClose }) {
  if (!text) return null;

  const colors = {
    info: "#1f2937",
    success: "#064e3b",
    error: "#5c1515",
  };

  return (
    <div
      style={{
        background: colors[type],
        border: "1px solid #333",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
      }}
      onClick={onClose}
    >
      {text}
    </div>
  );
}

/* ===============================
   APP
================================ */

export default function App() {
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState("");
  const [toast, setToast] = useState(null);

  const [input, setInput] = useState("");
  const [mem, setMem] = useState(loadMemory());

  const [isBooting, setIsBooting] = useState(false);
  const [saving, setSaving] = useState(false);

  const itemsSorted = useMemo(
    () => sortItems(mem.items || []),
    [mem.items]
  );

  /* ===============================
     BOOT
  ================================ */

  async function doBoot() {
    setIsBooting(true);
    setBootError("");
    try {
      const res = await bootstrapAnna();
      setBoot(res);
      setMem(loadMemory());
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

  /* ===============================
     SEND / MEMORY
  ================================ */

  async function onSend() {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setSaving(true);
    setBootError("");
    setToast(null);

    try {
      const suggestion = suggestMemoryFromText(text);

      // 🛑 HARTE VALIDIERUNG – KEIN kaputter POST mehr
      if (
        !suggestion ||
        !suggestion.type ||
        !suggestion.key ||
        typeof suggestion.value !== "string" ||
        suggestion.value.trim() === ""
      ) {
        setToast({
          type: "info",
          text: "Kein speicherbares Memory erkannt.",
        });
        setMem(loadMemory());
        return;
      }

      const patch = [
        {
          type: suggestion.type,
          key: suggestion.key,
          value: suggestion.value.trim(),
          confidence: suggestion.confidence || "high",
        },
      ];

      await upsertMemoryItems(patch);

      setToast({
        type: "success",
        text: `Gespeichert: ${patch[0].type}:${patch[0].key}`,
      });

      setMem(loadMemory());
    } catch (e) {
      setBootError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  /* ===============================
     ACTIONS
  ================================ */

  async function onRefreshBackend() {
    await doBoot();
  }

  function onReset() {
    resetAnnaStorage();
    setBoot(null);
    setMem(loadMemory());
    setBootError("");
    setInput("");
    doBoot();
  }

  /* ===============================
     RENDER
  ================================ */

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18 }}>
      <h1 style={{ marginBottom: 14 }}>
        ANNA – Text & Sprache + Memory + Cloud Voice
      </h1>

      <Toast
        text={toast?.text}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

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

      {/* BOOT STATUS */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          ✅ Boot-Status (Backend)
        </div>

        <div style={{ opacity: 0.9, marginBottom: 10 }}>
          {isBooting ? "Boot läuft…" : "Boot OK."}
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 13 }}>
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
          <button onClick={onReset}>Reset (löscht anna.*)</button>
        </div>
      </div>

      {/* CHAT */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          💬 Chat (MVP) + Natural Memory
        </div>

        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 8 }}>
          Tipp: „merk dir: preference tone = Schritt-für-Schritt“
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='z.B. "merk dir: tone = Schritt-für-Schritt"'
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #444",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
          />
          <button onClick={onSend} disabled={saving}>
            Senden
          </button>
        </div>
      </div>

      {/* MEMORY ITEMS */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          🧠 Memory Items
        </div>

        {itemsSorted.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Keine Items vorhanden.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {itemsSorted.map((it) => (
              <div
                key={`${it.type}:${it.key}`}
                style={{
                  border: "1px solid #333",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>
                    {it.type}:{it.key}
                  </strong>
                  <span style={{ opacity: 0.7 }}>{it.confidence}</span>
                </div>
                <div style={{ marginTop: 6 }}>{it.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ opacity: 0.65, fontSize: 12 }}>
        Hinweis: Backend läuft auf Render · Frontend als Static Site
      </div>
    </div>
  );
}
