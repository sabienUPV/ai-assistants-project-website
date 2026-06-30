import { z } from 'astro/zod';

export const postSchema = z.object({
  title: z.string(),
  pubDate: z.date().optional(),
  author: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  description: z.string().optional(),
});

export type Post = z.infer<typeof postSchema>;