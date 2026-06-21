#!/usr/bin/env node
/**
 * Generates Angular environment files from environment variables.
 * Run before `ng build` in CI/CD pipelines.
 *
 * Required env vars:
 *   TURNSTILE_SITE_KEY
 *   SUPABASE_ANON_KEY
 *   BOOKING_API_KEY
 *   BFF_BASE_URL (optional, has default)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if present (dev only — in CI env vars come from the platform)
const envLocalPath = join(__dirname, "../.env.local");
if (existsSync(envLocalPath)) {
  readFileSync(envLocalPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    });
}
const envDir = join(__dirname, "../src/environments");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const bffBaseUrl =
  process.env.BFF_BASE_URL ||
  "https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/booking-public";

// When the user is ready to do the BFF rename atomically, change this
// to 'https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/portal-public'
// AND ensure both the rename AND the Vercel env var happen in the same
// deploy. Don't do them independently — that creates a window where
// the frontend calls a function that exists but the user has not been
// redirected, or vice versa.

const supabaseFunctionsUrl =
  process.env.SUPABASE_FUNCTIONS_URL ||
  "https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1";

const turnstileSiteKey = requireEnv("TURNSTILE_SITE_KEY");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
const bookingApiKey = requireEnv("BOOKING_API_KEY");

const base = `  bffBaseUrl: "${bffBaseUrl}",
  supabaseFunctionsUrl: "${supabaseFunctionsUrl}",
  turnstileSiteKey: "${turnstileSiteKey}",
  clientId: "simplifica-agenda-frontend",
  supabaseAnonKey: "${supabaseAnonKey}",
  bookingApiKey: "${bookingApiKey}",`;

mkdirSync(envDir, { recursive: true });

writeFileSync(
  join(envDir, "environment.prod.ts"),
  `export const environment = {\n  production: true,\n${base}\n};\n`
);

writeFileSync(
  join(envDir, "environment.ts"),
  `export const environment = {\n  production: false,\n${base}\n};\n`
);

console.log("✓ Environment files generated");
