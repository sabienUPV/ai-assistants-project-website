import { z } from 'astro/zod';

export const PostSchema = z.object({
  title: z.string(),
  pubDate: z.date(),
  description: z.string(),
  author: z.string(),
});