import { z } from 'astro/zod';

export const postSchema = z.object({
  title: z.string(),
  pubDate: z.date(),
  description: z.string(),
  author: z.string(),
});

export type Post = z.infer<typeof postSchema>;