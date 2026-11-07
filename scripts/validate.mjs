#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { kbSchema } from "../src/lib/schema.js";

const file = resolve(process.cwd(), process.argv[2] ?? "content/kb.json");

let raw;
try {
  raw = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`✖ Could not read/parse ${file}`);
  console.error(`  ${error.message}`);
  process.exit(1);
}

const result = kbSchema.safeParse(raw);

if (!result.success) {
  console.error(`✖ ${file} is invalid:\n`);
  for (const issue of result.error.issues) {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    console.error(`  • ${path}: ${issue.message}`);
  }
  process.exit(1);
}

const kb = result.data;
const items = kb.sections.reduce((sum, section) => sum + section.items.length, 0);

console.log(`✔ ${file} is valid`);
console.log(`  title:    ${kb.title}`);
console.log(`  sections: ${kb.sections.length}`);
console.log(`  items:    ${items}`);

for (const section of kb.sections) {
  console.log(`  - ${section.id}: ${section.items.length} item(s)`);
}
