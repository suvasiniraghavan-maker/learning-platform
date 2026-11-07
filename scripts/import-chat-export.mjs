#!/usr/bin/env node
/**
 * Parses the extracted chat documents (exports/msg-*.md) into a knowledge base.
 *
 * Canonical sources, in order:
 *   msg-05 — v2.0: tracks 1–10 + modules A–C (with links and Gemini prompts)
 *   msg-07 — v3.0: tracks 11–16
 *   msg-09 — v4.0: tracks 17–19
 *
 * Output defaults to content/kb.imported.json so it can be reviewed first.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sources = [
  "exports/msg-05-assistant.md",
  "exports/msg-07-assistant.md",
  "exports/msg-09-assistant.md",
];
const output = resolve(root, process.argv[2] ?? "content/kb.json");

// Canonical display forms for acronyms and brand names. Keys are lowercase.
const CANONICAL = new Map(
  Object.entries({
    mcp: "MCP",
    rag: "RAG",
    owasp: "OWASP",
    gpu: "GPU",
    llm: "LLM",
    llms: "LLMs",
    api: "API",
    apis: "APIs",
    ai: "AI",
    pm: "PM",
    pms: "PMs",
    saas: "SaaS",
    json: "JSON",
    zdr: "ZDR",
    acl: "ACL",
    acls: "ACLs",
    sso: "SSO",
    scim: "SCIM",
    sql: "SQL",
    ui: "UI",
    ux: "UX",
    pdf: "PDF",
    prd: "PRD",
    prds: "PRDs",
    cpu: "CPU",
    vm: "VM",
    vms: "VMs",
    k8s: "K8s",
    "ci/cd": "CI/CD",
    genai: "GenAI",
    openai: "OpenAI",
    anthropic: "Anthropic",
    perplexity: "Perplexity",
    sonar: "Sonar",
    glean: "Glean",
    kroolo: "Kroolo",
    "m&a": "M&A",
    roi: "ROI",
    sla: "SLA",
    slas: "SLAs",
    tco: "TCO",
    pii: "PII",
    rfp: "RFP",
    rfps: "RFPs",
    dns: "DNS",
    http: "HTTP",
    https: "HTTPS",
    oauth: "OAuth",
    jwt: "JWT",
    sdk: "SDK",
    sdks: "SDKs",
    cli: "CLI",
    clis: "CLIs",
    ide: "IDE",
    ides: "IDEs",
  }),
);

const SMALL_WORDS = new Set([
  "vs",
  "and",
  "of",
  "the",
  "for",
  "to",
  "in",
  "on",
  "with",
  "a",
  "an",
  "or",
  "at",
  "by",
  "from",
  "as",
  "into",
  "over",
  "per",
]);

function prettifyTitle(value) {
  return value
    .replace(/\s+[—–]\s+/g, " — ")
    .replace(/\s+-\s+/g, " — ")
    .split(/\s+/)
    .map((word, index) => {
      const match = word.match(/^([^\w]*)([\w&/.-]+)([^\w]*)$/);
      if (!match) return word;

      const [, prefix, core, suffix] = match;
      const canonical = CANONICAL.get(core.toLowerCase());
      if (canonical) return `${prefix}${canonical}${suffix}`;

      if (core.includes("-")) {
        const parts = core.split("-").map((part, partIndex) => {
          const partCanonical = CANONICAL.get(part.toLowerCase());
          if (partCanonical) return partCanonical;
          const partLower = part.toLowerCase();
          if (partIndex > 0 && SMALL_WORDS.has(partLower)) return partLower;
          if (partIndex === 0) {
            return `${partLower.charAt(0).toUpperCase()}${partLower.slice(1)}`;
          }
          return partLower;
        });
        return `${prefix}${parts.join("-")}${suffix}`;
      }

      const lower = core.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) {
        return `${prefix}${lower}${suffix}`;
      }

      return `${prefix}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${suffix}`;
    })
    .join(" ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 58)
    .replace(/-$/g, "");
}

function clean(value) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripEmphasis(value) {
  return clean(value.replace(/\*\*/g, ""));
}

function parseMetadata(body) {
  const meta = {};
  const end = body.search(/\n### (?:Conceptual Foundation|Question Bank|Lab Exercises)/);
  const head = end === -1 ? body : body.slice(0, end);
  for (const match of head.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|$/gm)) {
    meta[match[1].trim()] = stripEmphasis(match[2]);
  }
  return meta;
}

function parseTableOptions(block) {
  const options = [];
  for (const line of block.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 6) continue;
    if (!/^[A-E]$/.test(cells[1])) continue;

    const correctCell = cells[3];
    const correct = /✅|✔|correct/i.test(correctCell) && !/wrong/i.test(correctCell);
    const explanation = stripEmphasis(
      cells[4].replace(/^\*\*Why (?:wrong|correct):\*\*\s*/i, ""),
    );

    options.push({
      id: cells[1],
      text: clean(cells[2]),
      correct,
      explanation,
    });
  }
  return options;
}

function parseListOptions(block) {
  const options = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*[*-]\s+\*\*([A-E])\)\*\*\s+(.+)$/);
    if (!match) continue;

    const rest = match[2].trim();
    const feedback = rest.match(
      /^(.*?)\s*\*\((Wrong|Correct)\s*:?\s*([\s\S]*?)\)\*\s*$/,
    );

    if (!feedback) {
      options.push({
        id: match[1],
        text: clean(rest.replace(/\*/g, "")),
        correct: false,
        explanation: "",
      });
      continue;
    }

    options.push({
      id: match[1],
      text: clean(feedback[1].replace(/\*/g, "")),
      correct: feedback[2] === "Correct",
      explanation: stripEmphasis(feedback[3]),
    });
  }
  return options;
}

function parseResources(block) {
  const marker = block.search(/\*\*(?:📚|📖)[^*]*Learn This Concept[^*]*:\*\*/);
  if (marker === -1) return [];

  const resources = [];
  let inTable = false;
  for (const line of block.slice(marker).split("\n")) {
    const isTableRow = line.trim().startsWith("|");
    if (!isTableRow) {
      if (inTable) break;
      continue;
    }
    inTable = true;

    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 5) continue;

    const title = stripEmphasis(cells[1]);
    const type = stripEmphasis(cells[2]);
    const rawLink = cells[3];
    if (!title || /^resource$/i.test(title) || /^-+$/.test(title)) continue;

    const linkMatch = rawLink.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    const urlMatch = rawLink.match(/https?:\/\/[^\s)]+/);
    const searchMatch = rawLink.match(/search\s*:\s*"?([^"]+?)"?\s*$/i);

    const resource = { title, type };
    if (linkMatch) {
      resource.url = linkMatch[2];
    } else if (urlMatch) {
      resource.url = urlMatch[0];
    } else if (searchMatch) {
      resource.search = searchMatch[1];
    }
    resources.push(resource);
  }
  return resources;
}

function parsePrinciple(block) {
  const match = block.match(
    /\*\*Principle:\*\*\s*([\s\S]*?)(?=\n\s*\*\*PM Implication|\n\s*\*\*(?:📚|📖|📓|🎯)|\n\s*---|\n\s*####|$)/,
  );
  return match ? stripEmphasis(match[1]) : "";
}

function parsePmImplication(block) {
  const match = block.match(
    /\*\*PM Implication:\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:📚|📖|📓|🎯)|\n\s*---|\n\s*####|$)/,
  );
  return match ? stripEmphasis(match[1]) : "";
}

function parseGeminiPrompt(block) {
  const match = block.match(
    /\*\*(?:📓|🎯)[^*]*Gemini Notebook Prompt[^*]*:\*\*\s*```(?:[a-zA-Z]*)\n([\s\S]*?)```/,
  );
  return match ? match[1].trim() : "";
}

function parseResourcesAndPrompt(block) {
  return {
    principle: parsePrinciple(block),
    pmImplication: parsePmImplication(block),
    geminiPrompt: parseGeminiPrompt(block),
    resources: parseResources(block),
  };
}

function parseQuizQuestion(block, heading) {
  const stemMatch = block.match(
    /\*\*Stem:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Options:\*\*|\n\s*\|\s*Option\s*\||\n\s*[*-]\s+\*\*A\)|\n\s*\*\*Principle:)/,
  );
  const question = stemMatch ? clean(stemMatch[1]) : "";

  const tableOptions = parseTableOptions(block);
  const listOptions = parseListOptions(block);
  const choices = tableOptions.length >= 2 ? tableOptions : listOptions;

  const extra = parseResourcesAndPrompt(block);
  const correct = choices.filter((choice) => choice.correct);
  const correctExplanation = correct
    .map((choice) => choice.explanation)
    .filter(Boolean)
    .join("\n\n");

  return {
    id: slugify(heading.id),
    kind: "mcq",
    question,
    answer: correct.map((choice) => `${choice.id}) ${choice.text}`).join("\n\n"),
    reasoning: correctExplanation || extra.principle,
    level: heading.level,
    levelName: heading.levelName,
    ...extra,
    tags: heading.level
      ? [`level-${heading.level}`, slugify(heading.levelName)]
      : [],
    difficulty: heading.level ?? 3,
    choices,
  };
}

function parseLab(block, heading) {
  const stemMatch = block.match(
    /\*\*Stem:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Lab Instructions:\*\*|\n\s*\*\*Principle:)/,
  );
  const question = stemMatch ? clean(stemMatch[1]) : "";

  const labMatch = block.match(
    /\*\*Lab Instructions:\*\*\s*```(?:[a-zA-Z]*)\n([\s\S]*?)```/,
  );
  const labInstructions = labMatch ? labMatch[1].trim() : "";

  const extra = parseResourcesAndPrompt(block);

  return {
    id: slugify(heading.id),
    kind: "lab",
    question,
    answer: extra.principle || "Complete the lab and write your reflection.",
    reasoning: "",
    level: null,
    levelName: heading.levelName,
    labInstructions,
    ...extra,
    tags: ["lab", "hands-on"],
    difficulty: 3,
    choices: [],
  };
}

const sections = [];
const warnings = [];

for (const source of sources) {
  const text = await readFile(resolve(root, source), "utf8");

  const sectionPattern =
    /^#{2,3}\s+(?:(\d+)\.\s+)?(TRACK|MODULE)\s+([A-Z0-9]+)\s*:\s*(.+?)\s*$/gm;
  const sectionMatches = [...text.matchAll(sectionPattern)];

  if (sectionMatches.length === 0) {
    warnings.push(`${source}: no sections found`);
    continue;
  }

  for (const [index, match] of sectionMatches.entries()) {
    const start = match.index + match[0].length;
    const end =
      index + 1 < sectionMatches.length
        ? sectionMatches[index + 1].index
        : text.length;
    const body = text.slice(start, end);

    const kind = match[2].toUpperCase();
    const number = match[3].toUpperCase();
    const title = prettifyTitle(match[4].trim());
    const metadata = parseMetadata(body);

    const questionPattern =
      /^####\s+(Q[A-Z0-9]+(?:\.\d+)?)\s*[—–-]\s*(.+?)\s*$/gm;
    const questionMatches = [...body.matchAll(questionPattern)];

    const items = [];
    for (const [questionIndex, questionMatch] of questionMatches.entries()) {
      const questionStart = questionMatch.index + questionMatch[0].length;
      const questionEnd =
        questionIndex + 1 < questionMatches.length
          ? questionMatches[questionIndex + 1].index
          : body.length;
      const block = body.slice(questionStart, questionEnd);

      const headingId = questionMatch[1];
      const rest = questionMatch[2].trim();
      const levelMatch = rest.match(/^Level\s+(\d+)\s*:\s*(.+)$/i);
      const labMatch = rest.match(/^Lab\s*:\s*(.+)$/i);

      let item;
      if (labMatch) {
        item = parseLab(block, {
          id: headingId,
          levelName: labMatch[1].trim(),
        });
      } else {
        item = parseQuizQuestion(block, {
          id: headingId,
          level: levelMatch ? Number(levelMatch[1]) : 3,
          levelName: levelMatch ? levelMatch[2].trim() : rest,
        });
      }

      if (!item.question) warnings.push(`${source} ${headingId}: empty stem`);
      if (item.kind === "mcq") {
        if (item.choices.length < 2) {
          warnings.push(
            `${source} ${headingId}: found ${item.choices.length} option(s)`,
          );
        }
        const correctCount = item.choices.filter((choice) => choice.correct).length;
        if (correctCount !== 1) {
          warnings.push(
            `${source} ${headingId}: ${correctCount} correct option(s)`,
          );
        }
        if (item.choices.some((choice) => !choice.text)) {
          warnings.push(`${source} ${headingId}: empty option text`);
        }
      }
      if (item.kind === "lab" && !item.labInstructions) {
        warnings.push(`${source} ${headingId}: lab has no instructions`);
      }

      items.push(item);
    }

    if (items.length === 0) {
      warnings.push(`${source}: section "${title}" has no questions`);
      continue;
    }

    const sectionId =
      kind === "TRACK"
        ? `track-${number.toLowerCase()}-${slugify(title)}`
        : `module-${number.toLowerCase()}-${slugify(title)}`;

    sections.push({
      id: sectionId,
      title,
      description: metadata.Focus || metadata["Core Principle"] || "",
      track: kind === "TRACK" ? Number(number) : null,
      module: kind === "MODULE" ? number : null,
      priority: metadata.Priority || "",
      focus: metadata.Focus || "",
      items,
      source: source,
    });
  }
}

sections.sort((a, b) => {
  if (a.track !== null && b.track !== null) return a.track - b.track;
  if (a.track !== null) return -1;
  if (b.track !== null) return 1;
  return String(a.module).localeCompare(String(b.module));
});

const questionCount = sections.reduce(
  (sum, section) => sum + section.items.length,
  0,
);
const mcqCount = sections.reduce(
  (sum, section) =>
    sum + section.items.filter((item) => item.kind === "mcq").length,
  0,
);

const kb = {
  version: 1,
  title: "AI Principles Q&A — The Complete Enterprise PM Learning Platform",
  description:
    "A 19-track curriculum on AI engineering for product managers: tokens, context, memory, RAG, evals, agents, security, harnesses, infrastructure, and enterprise data moats.",
  sections: sections.map(({ source, ...section }) => section),
};

await mkdir(resolve(root, "content"), { recursive: true });
await writeFile(output, `${JSON.stringify(kb, null, 2)}\n`, "utf8");

console.log(`✔ ${output}`);
console.log(`  sections: ${sections.length}`);
console.log(`  items:    ${questionCount} (${mcqCount} quiz + ${questionCount - mcqCount} labs)`);
console.log("");

for (const section of sections) {
  const label = section.track !== null ? `T${section.track}` : `Module ${section.module}`;
  console.log(`  ${label.padEnd(8)} ${section.title} — ${section.items.length} Q`);
}

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}
