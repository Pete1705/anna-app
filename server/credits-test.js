// server/credits-test.js
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

async function main() {
  const res = await fetch("https://api.d-id.com/credits", {
    method: "GET",
    headers: {
      Authorization: authHeader(DID_API_KEY),
      Accept: "application/json",
    },
  });

  console.log("HTTP Status:", res.status);

  console.log("Response headers (gefiltert):");
  for (const [k, v] of res.headers.entries()) {
    const key = k.toLowerCase();
    if (
      key.includes("request") ||
      key.includes("trace") ||
      key.includes("x-") ||
      key.includes("date") ||
      key.includes("server")
    ) {
      console.log(`  ${k}: ${v}`);
    }
  }

  const text = await res.text();
  console.log("Antwort-Body:", text);
}

main().catch(console.error);
