import { z } from 'astro/zod';
import { slugReservedKeywordsMessage, slugReservedKeywordsRegex } from '@schemas/validation';

export const postSchema = z.object({
  title: z.string().regex(slugReservedKeywordsRegex, { message: slugReservedKeywordsMessage }),
  pubDate: z.date().optional(),
  author: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  description: z.string().optional(),
});

export type Post = z.infer<typeof postSchema>;