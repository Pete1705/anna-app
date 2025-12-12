// src/anna/nlpMemory.ts
// Heuristiken für natürlichsprachige Memory-Vorschläge

export type MemorySuggestion = {
  type: "user" | "project" | "preference";
  key: string;
  value: string;
  confidence: "high" | "medium";
  reason: string;
};

function hasAny(text: string, needles: string[]) {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

export function suggestMemoryFromText(input: string): MemorySuggestion[] {
  const text = input.trim();
  if (!text) return [];

  // Explizite Commands NICHT doppelt behandeln
  const lower = text.toLowerCase();
  if (
    lower.startsWith("merk dir:") ||
    lower.startsWith("anna, merk dir:") ||
    lower.startsWith("remember:") ||
    lower.startsWith("anna, remember:")
  ) {
    return [];
  }

  const suggestions: MemorySuggestion[] = [];

  // Volle Codes / kompletter Code
  if (
    hasAny(text, [
      "volle codes",
      "vollen code",
      "ganzen code",
      "kompletten code",
      "kompletter code",
      "zum austauschen",
      "1:1 austauschen",
      "alles ersetzen",
    ])
  ) {
    suggestions.push({
      type: "preference",
      key: "code_delivery",
      value: "Immer vollständigen Code zum Austauschen liefern (keine Snippets).",
      confidence: "high",
      reason: "Wunsch nach vollständig austauschbarem Code erkannt",
    });
  }

  // Schritt-für-Schritt
  if (hasAny(text, ["schritt für schritt", "step by step", "punkt für punkt"])) {
    suggestions.push({
      type: "preference",
      key: "workflow",
      value: "Immer Schritt-für-Schritt vorgehen und jeden Punkt einzeln abschließen.",
      confidence: "high",
      reason: "Wunsch nach Schritt-für-Schritt Vorgehen erkannt",
    });
  }

  // Knapp / kein Kreis drehen
  if (
    hasAny(text, [
      "kein kreis",
      "nicht wiederholen",
      "wir drehen uns",
      "kurz und klar",
      "kein bla bla",
    ])
  ) {
    suggestions.push({
      type: "preference",
      key: "communication_style",
      value: "Kurz, klar, ohne Wiederholungen; Fokus auf Umsetzung.",
      confidence: "medium",
      reason: "Präferenz für knappe, fokussierte Kommunikation erkannt",
    });
  }

  // Deduplizieren nach type+key
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const k = `${s.type}:${s.key}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
