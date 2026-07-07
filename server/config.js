import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dependency needed)
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

export const config = {
  provider: process.env.PROVIDER || "mock",
  port: Number(process.env.PORT || 3000),
  sixt: {
    baseUrl: process.env.SIXT_API_BASE_URL || "",
    apiKey: process.env.SIXT_API_KEY || "",
    clientId: process.env.SIXT_CLIENT_ID || "",
    clientSecret: process.env.SIXT_CLIENT_SECRET || "",
  },
  limits: {
    maxFlexDays: 5,
    maxRadiusKm: 300,
    maxDateCombos: 200,
    offersPerCategory: 5,
  },
};
