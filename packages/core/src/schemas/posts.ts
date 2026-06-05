import { z } from 'astro/zod';

export const postSchema = z.object({
  title: z.string(),
  pubDate: z.date().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
});

export type Post = z.infer<typeof postSchema>;