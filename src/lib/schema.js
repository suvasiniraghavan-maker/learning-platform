import { z } from "zod";

/**
 * The knowledge-base contract. Both the build (src/lib/kb.ts) and the CLI
 * validator (scripts/validate.mjs) use this file, so there is one source of truth.
 */

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be lowercase kebab-case, e.g. 'cell-biology' or 'q-001'",
  );

export const choiceSchema = z.object({
  id: z.string().min(1).max(8),
  text: z.string().min(1),
  correct: z.boolean(),
  explanation: z.string().default(""),
});

export const resourceSchema = z.object({
  title: z.string().min(1),
  type: z.string().default(""),
  // Most resources have one of these; a few are physical/slide references.
  url: z.url().optional(),
  search: z.string().min(1).optional(),
});

export const itemSchema = z.object({
  id: slug,
  // "mcq" is auto-gradable; "lab" is a hands-on exercise.
  kind: z.enum(["mcq", "lab"]).default("mcq"),
  question: z.string().min(3),
  answer: z.string().default(""),
  reasoning: z.string().default(""),
  level: z.number().int().min(1).max(5).nullable().default(null),
  levelName: z.string().default(""),
  principle: z.string().default(""),
  pmImplication: z.string().default(""),
  labInstructions: z.string().default(""),
  tags: z.array(z.string().min(1)).default([]),
  difficulty: z.number().int().min(1).max(5).default(3),
  choices: z.array(choiceSchema).default([]),
  resources: z.array(resourceSchema).default([]),
  geminiPrompt: z.string().default(""),
});

export const sectionSchema = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().default(""),
  track: z.number().int().min(1).nullable().default(null),
  module: z.string().nullable().default(null),
  priority: z.string().default(""),
  focus: z.string().default(""),
  items: z.array(itemSchema).min(1),
});

export const kbSchema = z
  .object({
    version: z.literal(1),
    title: z.string().min(1),
    description: z.string().default(""),
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((kb, ctx) => {
    const sectionIds = new Set();
    const itemIds = new Set();

    for (const section of kb.sections) {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate section id: "${section.id}"`,
        });
      }
      sectionIds.add(section.id);

      for (const item of section.items) {
        if (itemIds.has(item.id)) {
          ctx.addIssue({
            code: "custom",
            message: `duplicate item id: "${item.id}" (ids must be unique across all sections)`,
          });
        }
        itemIds.add(item.id);

        if (item.kind === "mcq") {
          if (item.choices.length < 2) {
            ctx.addIssue({
              code: "custom",
              message: `item "${item.id}" is multiple-choice but has ${item.choices.length} choice(s)`,
            });
          }

          const correct = item.choices.filter((choice) => choice.correct);
          if (item.choices.length > 0 && correct.length !== 1) {
            ctx.addIssue({
              code: "custom",
              message: `item "${item.id}" must have exactly one correct choice (has ${correct.length})`,
            });
          }
        }

        if (item.kind === "lab" && !item.labInstructions) {
          ctx.addIssue({
            code: "custom",
            message: `lab "${item.id}" has no labInstructions`,
          });
        }
      }
    }
  });
