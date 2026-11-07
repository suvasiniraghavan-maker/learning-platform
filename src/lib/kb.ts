import raw from "../../content/kb.json";
import { kbSchema } from "./schema.js";

export interface Reference {
  title: string;
  url: string;
}

export interface Item {
  id: string;
  question: string;
  answer: string;
  reasoning: string;
  tags: string[];
  difficulty: number;
  references: Reference[];
  choices?: string[];
  correctIndex?: number;
}

export interface Section {
  id: string;
  title: string;
  description: string;
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

export const totalItems = sections.reduce(
  (sum, section) => sum + section.items.length,
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
