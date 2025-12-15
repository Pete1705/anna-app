import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { bootstrapAnna } from "./anna/bootstrap";
import { loadMemory, upsertMemoryItems, resetAnnaStorage } from "./anna/memory";
import { suggestMemoryFromText } from "./anna/nlpMemory";

// --- helpers ---
function sortItems(items) {
  return [...items].sort((a, b) => {
    const t = (a.type || "").localeCompare(b.type || "");
    if (t !== 0) return t;
    return (a.key || "").localeCompare(b.key || "");
  });
}

function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function IconButton({ title, onClick, children }) {
  return (
    <button className="iconBtn" title={title} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function safeCopy(text) {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState("");
  const [input, setInput] = useState("");
  const [mem, setMem] = useState(loadMemory());
  const [isBooting, setIsBooting] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI niceties
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [activeType, setActiveType] = useState("all");

  const itemsSorted = useMemo(() => sortItems(mem.items || []), [mem.items]);

  const types = useMemo(() => {
    const s = new Set((mem.items || []).map((i) => i.type).filter(Boolean));
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [mem.items]);

  const itemsFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return itemsSorted.filter((it) => {
      if (activeType !== "all" && it.type !== activeType) return false;
      if (!q) return true;
      return (
        String(it.type || "").toLowerCase().includes(q) ||
        String(it.key || "").toLowerCase().includes(q) ||
        String(it.value || "").toLowerCase().includes(q)
      );
    });
  }, [itemsSorted, filter, activeType]);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2200);
  }

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

  async function onSend() {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setSaving(true);
    setBootError("");

    try {
      const suggestion = suggestMemoryFromText(text);

      if (!suggestion) {
        showToast("Kein Memory-Command erkannt.");
        setMem(loadMemory());
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
      setMem(loadMemory());
      showToast("Gespeichert ✅");
    } catch (e) {
      setBootError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function onRefreshBackend() {
    await doBoot();
    showToast("Aktualisiert");
  }

  async function onReset() {
    // local reset + backend reset (falls implementiert)
    try {
      await resetAnnaStorage();
    } catch {
      // ignore, UI should still reset locally
    }
    setBoot(null);
    setMem(loadMemory());
    setBootError("");
    setInput("");
    showToast("Zurückgesetzt");
    doBoot();
  }

  const statusTone = bootError ? "danger" : isBooting ? "warn" : "ok";

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">A.N.N.A</div>
          <div className="brand__subtitle">Text · Sprache · Memory · Cloud Voice</div>
        </div>

        <div className="topbar__actions">
          <Badge tone={statusTone}>
            {bootError ? "Backend Error" : isBooting ? "Booting…" : "Online"}
          </Badge>
          <button className="btn btn--ghost" onClick={onRefreshBackend} disabled={isBooting}>
            Refresh
          </button>
          <button className="btn btn--danger" onClick={onReset}>
            Reset
          </button>
        </div>
      </header>

      {toast ? <div className="toast">{toast}</div> : null}

      {bootError ? (
        <div className="alert alert--danger">
          <div className="alert__title">Backend/Memory Error</div>
          <div className="alert__body">{bootError}</div>
        </div>
      ) : null}

      <main className="grid">
        {/* LEFT: Boot / Status */}
        <section className="card">
          <div className="card__head">
            <div className="card__title">Boot-Status</div>
            <div className="card__meta">
              <Badge tone={isBooting ? "warn" : bootError ? "danger" : "ok"}>
                {isBooting ? "lädt…" : bootError ? "Fehler" : "OK"}
              </Badge>
            </div>
          </div>

          <div className="kv">
            <div className="kv__row">
              <div className="kv__k">sessionId</div>
              <div className="kv__v mono">
                {boot?.sessionId || "—"}
                {boot?.sessionId ? (
                  <IconButton
                    title="sessionId kopieren"
                    onClick={() => {
                      if (safeCopy(boot.sessionId)) showToast("sessionId kopiert");
                    }}
                  >
                    ⧉
                  </IconButton>
                ) : null}
              </div>
            </div>

            <div className="kv__row">
              <div className="kv__k">memoryId</div>
              <div className="kv__v mono">
                {mem?.memoryId || "—"}
                {mem?.memoryId ? (
                  <IconButton
                    title="memoryId kopieren"
                    onClick={() => {
                      if (safeCopy(mem.memoryId)) showToast("memoryId kopiert");
                    }}
                  >
                    ⧉
                  </IconButton>
                ) : null}
              </div>
            </div>

            <div className="kv__row">
              <div className="kv__k">memoryVersion</div>
              <div className="kv__v mono">{mem?.version ?? "—"}</div>
            </div>

            <div className="kv__row">
              <div className="kv__k">items</div>
              <div className="kv__v mono">{mem?.items?.length ?? 0}</div>
            </div>
          </div>

          <div className="hint">
            Tipp: Teste Persistenz, indem du ein Item speicherst, dann Backend redeployst und prüfst,
            ob es danach noch da ist.
          </div>
        </section>

        {/* RIGHT: Chat + Memory */}
        <section className="card card--tall">
          <div className="card__head">
            <div className="card__title">Chat + Natural Memory</div>
            <div className="card__meta">
              <span className="muted">
                Beispiel: <span className="mono">merk dir: preference tone = Schritt-für-Schritt</span>
              </span>
            </div>
          </div>

          <div className="chatBox">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='z.B. "merk dir: tone = Schritt-für-Schritt"'
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend();
              }}
            />
            <button className="btn btn--primary" onClick={onSend} disabled={saving}>
              {saving ? "Speichern…" : "Senden"}
            </button>
          </div>

          <div className="toolbar">
            <div className="segmented">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`segmented__btn ${activeType === t ? "is-active" : ""}`}
                  onClick={() => setActiveType(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              className="input input--small"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter: type/key/value…"
            />
          </div>

          <div className="list">
            {itemsFiltered.length === 0 ? (
              <div className="empty">
                <div className="empty__title">Keine Items gefunden.</div>
                <div className="empty__text">
                  Speichere eins über den Chat oder nutze „Reset“ um alles zu löschen.
                </div>
              </div>
            ) : (
              itemsFiltered.map((it) => (
                <div key={`${it.type}:${it.key}`} className="item">
                  <div className="item__top">
                    <div className="item__key">
                      <span className="pill">{it.type}</span>
                      <span className="mono">{it.key}</span>
                    </div>

                    <div className="item__right">
                      <Badge tone={it.confidence === "low" ? "warn" : "ok"}>{it.confidence}</Badge>
                      <IconButton
                        title="Wert kopieren"
                        onClick={() => {
                          if (safeCopy(String(it.value ?? ""))) showToast("Wert kopiert");
                        }}
                      >
                        ⧉
                      </IconButton>
                    </div>
                  </div>

                  <div className="item__value">{it.value}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="muted">
          Backend: Render Web Service · Frontend: Render Static Site
        </span>
      </footer>
    </div>
  );
}
