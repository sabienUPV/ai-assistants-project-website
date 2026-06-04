import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from '@sabien-upv-astro-cms/core';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/posts' }),
  // Type-check frontmatter using a schema
  schema: postSchema,
});

export const collections = { posts };
