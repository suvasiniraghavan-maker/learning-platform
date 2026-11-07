#!/usr/bin/env node
/**
 * Builds one Markdown bundle per section, ready to upload to Gemini Notebook
 * (or to push with the Gemini Notebook API once OAuth is configured).
 *
 * Output:
 *   dist-notebooks/<section-id>.md
 *   dist-notebooks/index.md
 *   dist-notebooks/manifest.json
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { kbSchema } from "../src/lib/schema.js";

const root = process.cwd();
const outDir = resolve(root, "dist-notebooks");
const kbPath = resolve(root, "content/kb.json");
const manifestPath = resolve(outDir, "manifest.json");

const raw = JSON.parse(await readFile(kbPath, "utf8"));
const parsed = kbSchema.safeParse(raw);

if (!parsed.success) {
  console.error(`✖ ${kbPath} is invalid — run "npm run validate" for details`);
  process.exit(1);
}

const kb = parsed.data;

// Keep existing notebook IDs/URLs across runs so syncing stays idempotent.
let previous = {};
try {
  const existing = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of existing.notebooks ?? []) {
    previous[entry.sectionId] = entry.notebook ?? { id: null, url: null };
  }
} catch {
  // First run, or no manifest yet.
}

function renderSection(section) {
  const lines = [];

  lines.push(`# ${section.title}`, "");
  if (section.description) lines.push(section.description, "");
  lines.push(
    "> Study material generated from a knowledge base. Each entry has a question,",
    "> the answer, and the reasoning behind it. Use the questions for retrieval",
    "> practice: try to answer before reading the reasoning.",
    "",
    "## Questions and reasoning",
    "",
  );

  section.items.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.question}`, "");
    lines.push(`**Answer.** ${item.answer}`, "");
    lines.push(`**Reasoning.** ${item.reasoning}`, "");

    if (item.tags.length > 0) {
      lines.push(`Tags: ${item.tags.join(", ")}`, "");
    }

    if (item.references.length > 0) {
      lines.push("Further reading:", "");
      for (const reference of item.references) {
        lines.push(`- [${reference.title}](${reference.url})`);
      }
      lines.push("");
    }

    lines.push("---", "");
  });

  lines.push(
    "## Suggested notebook prompts",
    "",
    "- Summarise this section as a one-page study guide.",
    "- Generate 10 exam-style questions from these concepts, with answers.",
    "- Explain the three hardest ideas here to a beginner, using analogies.",
    "- Create a mind map connecting the tags in this section.",
    "- Make an audio overview focused on the reasoning, not just the answers.",
    "",
  );

  return lines.join("\n");
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const notebooks = [];

for (const section of kb.sections) {
  const content = renderSection(section);
  const file = `${section.id}.md`;
  await writeFile(resolve(outDir, file), content, "utf8");

  notebooks.push({
    sectionId: section.id,
    title: section.title,
    file,
    contentHash: createHash("sha256").update(content).digest("hex"),
    questions: section.items.length,
    references: section.items.reduce(
      (sum, item) => sum + item.references.length,
      0,
    ),
    notebook: previous[section.id] ?? { id: null, url: null },
  });
}

const index = [
  `# ${kb.title} — notebook bundles`,
  "",
  "One notebook per section. Upload the matching Markdown file as a source,",
  "or sync them with the Gemini Notebook API.",
  "",
  ...notebooks.map(
    (entry) =>
      `- **${entry.title}** — \`${entry.file}\` (${entry.questions} questions, ${entry.references} references)`,
  ),
  "",
].join("\n");

await writeFile(resolve(outDir, "index.md"), index, "utf8");

await writeFile(
  manifestPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      title: kb.title,
      notebooks,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`✔ Notebook bundles written to ${outDir}`);
for (const entry of notebooks) {
  console.log(
    `  - ${entry.file}  (${entry.questions} questions, ${entry.references} references)`,
  );
}
