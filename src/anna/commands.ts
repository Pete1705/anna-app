// src/anna/commands.ts
import { upsertMemoryItems } from "./memory";

export type ParsedRememberCommand = {
  type: "user" | "project" | "preference";
  key: string;
  value: string;
  confidence: "high" | "medium";
};

const TYPE_SET = new Set(["user", "project", "preference"]);

function normalize(s: string) {
  return s.trim();
}

function stripPrefix(input: string): string {
  const t = input.trim();
  const patterns = [
    /^anna[, ]+\s*merk\s+dir\s*:\s*/i,
    /^merk\s+dir\s*:\s*/i,
    /^anna[, ]+\s*remember\s*:\s*/i,
    /^remember\s*:\s*/i,
  ];
  for (const p of patterns) {
    if (p.test(t)) return t.replace(p, "");
  }
  return "";
}

export function parseRememberCommand(input: string): ParsedRememberCommand | null {
  const body = stripPrefix(input);
  if (!body) return null;

  let confidence: "high" | "medium" = "high";
  let working = body;

  const confMatch = working.match(/\s@(?<c>high|medium)\s*$/i);
  if (confMatch?.groups?.c) {
    confidence = confMatch.groups.c.toLowerCase() as "high" | "medium";
    working = working.replace(/\s@(?:high|medium)\s*$/i, "").trim();
  }

  const eqIdx = working.indexOf("=");
  if (eqIdx === -1) return null;

  const left = normalize(working.slice(0, eqIdx));
  const right = normalize(working.slice(eqIdx + 1));
  if (!left || !right) return null;

  const parts = left.split(/\s+/).filter(Boolean);

  let type: "user" | "project" | "preference" = "preference";
  let key = "";

  if (parts.length >= 2 && TYPE_SET.has(parts[0].toLowerCase())) {
    type = parts[0].toLowerCase() as any;
    key = parts.slice(1).join("_");
  } else {
    key = parts.join("_");
  }

  key = key.trim();
  if (!key) return null;

  return { type, key, value: right, confidence };
}

export async function executeRememberCommand(cmd: ParsedRememberCommand) {
  return upsertMemoryItems([
    { type: cmd.type, key: cmd.key, value: cmd.value, confidence: cmd.confidence },
  ]);
}
