// Loads API keys from .env.local (gitignored) for server-side scripts.
// Avoids hard-coding secrets into committed source. process.env is unavailable
// in this sandbox Node, so we parse the file directly.
import { readFileSync } from "fs";

function loadEnv() {
  try {
    const txt = readFileSync("/home/jack/french-shadowing/.env.local", "utf-8");
    const out = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

export const ENV = loadEnv();
export const GEMINI_KEY = ENV.GEMINI_API_KEY || "";
export const GLM_KEY = ENV.GLM_API_KEY || "";
