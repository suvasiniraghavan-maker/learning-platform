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

function sectionLabel(section) {
  return section.track !== null
    ? `Track ${section.track}`
    : `Module ${section.module ?? ""}`.trim();
}

function renderChoices(item) {
  const lines = ["**Options.**", ""];
  for (const choice of item.choices) {
    const marker = choice.correct ? "✅" : "❌";
    lines.push(`- ${marker} **${choice.id})** ${choice.text}`);
    if (choice.explanation) lines.push(`  - ${choice.explanation}`);
  }
  lines.push("");
  return lines;
}

function renderResources(item) {
  if (item.resources.length === 0) return [];

  const lines = ["**Learn this concept.**", ""];
  for (const resource of item.resources) {
    const type = resource.type ? ` — ${resource.type}` : "";
    if (resource.url) {
      lines.push(`- [${resource.title}](${resource.url})${type}`);
    } else if (resource.search) {
      lines.push(`- ${resource.title}${type} (search: "${resource.search}")`);
    } else {
      lines.push(`- ${resource.title}${type}`);
    }
  }
  lines.push("");
  return lines;
}

function renderSection(section) {
  const lines = [];

  lines.push(`# ${section.title}`, "");
  lines.push(`*${sectionLabel(section)} · ${section.items.length} item(s)*`, "");
  if (section.description) lines.push(section.description, "");
  if (section.priority) lines.push(`**Priority:** ${section.priority}`, "");
  lines.push(
    "> Study material generated from a knowledge base. Each entry has a question,",
    "> the options, the answer, the principle, the PM implication, and further",
    "> reading. Use the questions for retrieval practice: try to answer before",
    "> reading the explanation.",
    "",
    "## Questions and reasoning",
    "",
  );

  section.items.forEach((item, index) => {
    const kind = item.kind === "lab" ? "Hands-on lab" : item.levelName || `Level ${item.level}`;
    lines.push(`### ${index + 1}. ${item.question}`, "");
    lines.push(`*${kind}*`, "");

    if (item.kind === "lab") {
      if (item.labInstructions) {
        lines.push("**Lab instructions.**", "", "```", item.labInstructions, "```", "");
      }
    } else {
      lines.push(...renderChoices(item));
      lines.push(`**Answer.** ${item.answer}`, "");
      if (item.reasoning) lines.push(`**Why.** ${item.reasoning}`, "");
    }

    if (item.principle) lines.push(`**Principle.** ${item.principle}`, "");
    if (item.pmImplication) {
      lines.push(`**PM implication.** ${item.pmImplication}`, "");
    }

    lines.push(...renderResources(item));

    if (item.geminiPrompt) {
      lines.push(
        "**Gemini Notebook prompt.**",
        "",
        "```",
        item.geminiPrompt,
        "```",
        "",
      );
    }

    lines.push("---", "");
  });

  lines.push(
    "## Suggested notebook prompts",
    "",
    "- Summarise this section as a one-page study guide for a product manager.",
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

  const quiz = section.items.filter((item) => item.kind === "mcq").length;
  const labs = section.items.length - quiz;

  notebooks.push({
    sectionId: section.id,
    title: section.title,
    label: sectionLabel(section),
    file,
    contentHash: createHash("sha256").update(content).digest("hex"),
    questions: quiz,
    labs,
    resources: section.items.reduce(
      (sum, item) => sum + item.resources.length,
      0,
    ),
    prompts: section.items.filter((item) => item.geminiPrompt).length,
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
      `- **${entry.label}: ${entry.title}** — \`${entry.file}\` (${entry.questions} quiz, ${entry.labs} lab, ${entry.resources} resources)`,
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
    `  - ${entry.file}  (${entry.questions} quiz, ${entry.labs} lab, ${entry.resources} resources)`,
  );
}
