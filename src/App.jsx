import { useState } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hey Pete, ich bin deine Anna-App. Schreib mir etwas – ich antworte gleich wirklich über deinen Server. 😊"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input.trim() };

    // Bisherige Nachrichten + neue User-Nachricht
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // System-Prompt für Anna
      const systemMessage = {
        role: "system",
        content:
          "Du bist A.N.N.A – eine charmante, leicht freche, aber professionelle Assistentin. Sprich Pete mit 'du' an und sei klar, strukturiert und hilfreich."
      };

      const response = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [systemMessage, ...newMessages]
        })
      });

      if (!response.ok) {
        throw new Error("Fehler vom Server");
      }

      const data = await response.json();
      const reply = data.reply;

      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hmm, da ist gerade etwas schiefgelaufen mit dem Backend. Versuch es gleich nochmal – oder sag mir, was du zuletzt getan hast."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="anna-avatar-circle">A</div>
        <div>
          <div className="app-title">A.N.N.A</div>
          <div className="app-subtitle">Deine persönliche Assistentin</div>
        </div>
      </header>

      <main className="chat-container">
        <div className="messages">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                "message " + (m.role === "user" ? "message-user" : "message-anna")
              }
            >
              <div className="message-meta">
                {m.role === "user" ? "Du" : "Anna"}
              </div>
              <div className="message-bubble">{m.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className="message message-anna">
              <div className="message-meta">Anna</div>
              <div className="message-bubble">Einen Moment, ich denke kurz…</div>
            </div>
          )}
        </div>
      </main>

      <footer className="input-area">
        <textarea
          className="input-field"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Schreib mir etwas… (Enter = senden, Shift+Enter = neue Zeile)"
        />
        <button className="send-button" onClick={sendMessage} disabled={isLoading}>
          {isLoading ? "…" : "Senden"}
        </button>
      </footer>
    </div>
  );
}

export default App;
