import raw from "../../content/kb.json";
import { kbSchema } from "./schema.js";

export interface Choice {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
}

export interface Resource {
  title: string;
  type: string;
  url?: string;
  search?: string;
}

export interface Item {
  id: string;
  kind: "mcq" | "lab";
  question: string;
  answer: string;
  reasoning: string;
  level: number | null;
  levelName: string;
  principle: string;
  pmImplication: string;
  labInstructions: string;
  tags: string[];
  difficulty: number;
  choices: Choice[];
  resources: Resource[];
  geminiPrompt: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  track: number | null;
  module: string | null;
  priority: string;
  focus: string;
  items: Item[];
}

export interface KnowledgeBase {
  version: 1;
  title: string;
  description: string;
  sections: Section[];
}

// Throws at build time (fail fast) if content/kb.json does not match the schema.
// Run `npm run validate` for a readable error report.
export const kb = kbSchema.parse(raw) as KnowledgeBase;

export const sections: Section[] = kb.sections;
export const tracks = sections.filter((section) => section.track !== null);
export const modules = sections.filter((section) => section.track === null);

export const totalItems = sections.reduce(
  (sum, section) => sum + section.items.length,
  0,
);

export const totalQuizItems = sections.reduce(
  (sum, section) =>
    sum + section.items.filter((item) => item.kind === "mcq").length,
  0,
);

export const totalLabs = sections.reduce(
  (sum, section) =>
    sum + section.items.filter((item) => item.kind === "lab").length,
  0,
);

export function getSection(id: string): Section | undefined {
  return sections.find((section) => section.id === id);
}

export function sectionPath(id: string): string {
  return `/sections/${id}/`;
}

export function quizPath(id: string): string {
  return `/quiz/${id}/`;
}

export function sectionLabel(section: Section): string {
  if (section.track !== null) return `Track ${section.track}`;
  return `Module ${section.module ?? ""}`.trim();
}

export function levelRange(items: Item[]): string {
  const levels = items
    .map((item) => item.level)
    .filter((level): level is number => typeof level === "number");
  if (levels.length === 0) return "Lab";
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return min === max ? `Level ${min}` : `Levels ${min}–${max}`;
}

export function quizItems(section: Section): Item[] {
  return section.items.filter((item) => item.kind === "mcq");
}
