// server/did-test.js
import "dotenv/config";
import fetch from "node-fetch";

const DID_API_KEY = process.env.DID_API_KEY;
if (!DID_API_KEY) {
  console.error("❌ DID_API_KEY fehlt");
  process.exit(1);
}

function authHeader(key) {
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// ✅ Projekt-ID aus /credits -> last_charge_entity_id
const PROJECT_ID = "prj_zKLWYQHFkdYHDbZ77JW4z";
const API_URL = `https://api.d-id.com/talks?project_id=${PROJECT_ID}`;

async function main() {
  console.log("👉 Starte D-ID Talk Test (mit project_id)…");

  const payload = {
  source_url: "https://raw.githubusercontent.com/d-id-dev/examples/main/assets/elon.jpg",
  script: {
    type: "text",
    input: "Hello Pete. Minimal talk without provider."
  }
};

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(DID_API_KEY),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log("HTTP Status:", res.status);

  const reqId =
    res.headers.get("x-amzn-requestid") ||
    res.headers.get("x-request-id") ||
    res.headers.get("request-id");
  if (reqId) console.log("Request-ID:", reqId);

  const text = await res.text();
  console.log("Antwort-Body:", text);

  if (!res.ok) {
    console.error("❌ Talk-Erstellung fehlgeschlagen");
    return;
  }

  const data = JSON.parse(text);
  console.log("✅ Talk erstellt. ID:", data.id);
}

main().catch(console.error);
