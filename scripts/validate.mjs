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
const items = kb.sections.flatMap((section) => section.items);
const quiz = items.filter((item) => item.kind === "mcq");
const labs = items.filter((item) => item.kind === "lab");
const withPrompt = items.filter((item) => item.geminiPrompt).length;
const withResources = items.filter((item) => item.resources.length > 0).length;

console.log(`✔ ${file} is valid`);
console.log(`  title:     ${kb.title}`);
console.log(`  sections:  ${kb.sections.length}`);
console.log(`  items:     ${items.length} (${quiz.length} quiz, ${labs.length} labs)`);
console.log(`  resources: ${withResources} items have further reading`);
console.log(`  prompts:   ${withPrompt} items have a Gemini Notebook prompt`);
console.log("");

for (const section of kb.sections) {
  const label =
    section.track !== null ? `T${section.track}` : `Module ${section.module}`;
  const sectionQuiz = section.items.filter((item) => item.kind === "mcq").length;
  const sectionLabs = section.items.length - sectionQuiz;
  const detail = sectionLabs
    ? `${sectionQuiz} quiz + ${sectionLabs} lab`
    : `${sectionQuiz} quiz`;
  console.log(`  ${label.padEnd(9)} ${section.title} — ${detail}`);
}
