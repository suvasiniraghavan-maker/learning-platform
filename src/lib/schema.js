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

export const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
});

export const itemSchema = z.object({
  id: slug,
  question: z.string().min(3),
  answer: z.string().min(1),
  reasoning: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  difficulty: z.number().int().min(1).max(5).default(3),
  references: z.array(referenceSchema).default([]),
  // Optional multiple-choice data. When absent the item is self-graded.
  choices: z.array(z.string().min(1)).min(2).optional(),
  correctIndex: z.number().int().min(0).optional(),
});

export const sectionSchema = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().default(""),
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

        if (item.choices && item.correctIndex === undefined) {
          ctx.addIssue({
            code: "custom",
            message: `item "${item.id}" has choices but no correctIndex`,
          });
        }
        if (
          item.correctIndex !== undefined &&
          item.choices &&
          item.correctIndex >= item.choices.length
        ) {
          ctx.addIssue({
            code: "custom",
            message: `item "${item.id}" correctIndex is out of range`,
          });
        }
      }
    }
  });
