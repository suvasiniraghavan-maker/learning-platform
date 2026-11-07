#!/usr/bin/env node
/**
 * Create/update Gemini Notebooks from dist-notebooks/manifest.json.
 *
 * Prerequisites:
 *   1. npm run notebooks
 *   2. An OAuth 2.0 access token with scope
 *      https://www.googleapis.com/auth/notebook
 *
 * Usage (PowerShell):
 *   $env:GEMINI_NOTEBOOK_TOKEN = "..."
 *   $env:GOOGLE_PROJECT_ID = "my-project"   # only needed for ADC tokens
 *   node scripts/sync-notebooks.mjs --dry-run
 *   node scripts/sync-notebooks.mjs
 *
 * Flags:
 *   --dry-run     Print what would happen; no API calls.
 *   --force       Re-upload content even if the hash is unchanged.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const API = "https://notebook.googleapis.com/v1";
const root = process.cwd();
const manifestPath = resolve(root, "dist-notebooks/manifest.json");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const token = process.env.GEMINI_NOTEBOOK_TOKEN ?? process.env.GOOGLE_ACCESS_TOKEN;
const projectId = process.env.GOOGLE_PROJECT_ID;

if (!dryRun && !token) {
  console.error(
    "✖ Missing token. Set GEMINI_NOTEBOOK_TOKEN to an OAuth access token with the\n" +
      "  https://www.googleapis.com/auth/notebook scope, or run with --dry-run.",
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  console.error(
    `✖ Could not read ${manifestPath}. Run "npm run notebooks" first.`,
  );
  process.exit(1);
}

function headers() {
  const value = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (projectId) value["x-goog-user-project"] = projectId;
  return value;
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function api(path, options = {}, attempt = 1) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers ?? {}) },
  });

  if (response.ok) {
    return response.status === 204 ? null : response.json();
  }

  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < 5) {
    const wait = Math.min(8000, 500 * 2 ** attempt);
    console.warn(`  ! ${response.status} — retrying in ${wait}ms`);
    await sleep(wait);
    return api(path, options, attempt + 1);
  }

  let detail = "";
  try {
    detail = JSON.stringify(await response.json());
  } catch {
    detail = await response.text();
  }
  throw new Error(`${options.method ?? "GET"} ${path} → ${response.status} ${detail}`);
}

async function createNotebook(title) {
  const body = JSON.stringify({ display_name: title });
  if (dryRun) {
    console.log(`  [dry-run] create notebook "${title}"`);
    return { id: "notebooks/dry-run", url: null };
  }
  const response = await api("/notebooks", { method: "POST", body });
  return { id: response.name, url: null };
}

async function addSource(notebookId, displayName, textContent) {
  const body = JSON.stringify({
    display_name: displayName,
    text_content: textContent,
  });
  if (dryRun) {
    console.log(`  [dry-run] add source "${displayName}" (${textContent.length} bytes)`);
    return;
  }
  await api(`/${notebookId}/sources`, { method: "POST", body });
}

let created = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

for (const entry of manifest.notebooks) {
  console.log(`\n• ${entry.title} (${entry.sectionId})`);

  try {
    const markdown = await readFile(resolve(root, "dist-notebooks", entry.file), "utf8");
    const alreadySynced =
      !force &&
      entry.notebook?.id &&
      entry.notebook.syncedHash === entry.contentHash;

    if (alreadySynced) {
      console.log("  = unchanged, skipping");
      skipped += 1;
      continue;
    }

    if (!entry.notebook?.id) {
      entry.notebook = await createNotebook(entry.title);
      entry.notebook.syncedHash = null;
      created += 1;
      console.log(`  + created ${entry.notebook.id}`);
    }

    const version = force || entry.notebook.syncedHash
      ? ` — updated ${new Date().toISOString().slice(0, 10)}`
      : "";
    await addSource(
      entry.notebook.id,
      `${entry.title}${version}`,
      markdown,
    );

    entry.notebook.syncedHash = entry.contentHash;
    updated += 1;
    console.log("  ✓ source synced");

    // Stay under the 20 CreateSource requests/minute per-user limit.
    if (!dryRun) await sleep(350);
  } catch (error) {
    failed += 1;
    console.error(`  ✖ ${error.message}`);
  }
}

if (!dryRun) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\n✔ Manifest updated: ${manifestPath}`);
}

console.log(
  `\nSummary: ${created} created, ${updated} synced, ${skipped} skipped, ${failed} failed`,
);

if (failed > 0) process.exit(1);
