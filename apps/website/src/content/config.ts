import { defineCollection, z } from "astro:content";

const guides = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    role: z.enum(["admin", "teacher", "student", "parent"]),
    steps: z.array(z.string()),
  }),
});

export const collections = { guides };
