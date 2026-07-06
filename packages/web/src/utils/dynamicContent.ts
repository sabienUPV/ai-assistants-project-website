import type { Locale } from '@languages';
import Markdoc from '@markdoc/markdoc';
import type { Course, Post } from '@sabien-upv-astro-cms/core';
import type { CollectionEntry } from 'astro:content';

type DynamicContentCollectionName = 'posts' | 'courses';
type DynamicContentEntry<Name extends DynamicContentCollectionName, Data extends Record<string, unknown>> = CollectionEntry<`${Name}_${Locale}`> & { data: Data };

export type PostEntry = DynamicContentEntry<'posts', Post>;
export type CourseEntry = DynamicContentEntry<'courses', Course>;

// Helper functions for dynamic content (e.g. blog posts)

export function getSlugFromEntryId(entryId: string): string {
  // Assuming the entryId is in the format "locale/posts/slug", we can split by '/' and take the last part
  const parts = entryId.split('/');
  return parts[parts.length - 1];
}

export function getEntryIdFromSlug(locale: string, collection: string, slug: string): string {
  // Construct the entryId in the format "locale/posts/slug"
  return `${locale}/${collection}/${slug}`;
}

export function getExcerptFromBody(body: string | undefined, maxLength: number = 150): string {
  if (!body) return '';

  // 1. Generate the AST tree
  const ast = Markdoc.parse(body);
  let pureText = '';

  // 2. Traverse the AST looking for ONLY pure text nodes
  for (const node of ast.walk()) {
    if (node.type === 'text' && typeof node.attributes.content === 'string') {
      // Append a space after every text node to prevent adjacent structural blocks 
      // (like separate paragraphs) from sticking together.
      pureText += node.attributes.content + ' ';

      // Optimization: if we've already collected enough text, we stop traversing the tree
      if (pureText.length >= maxLength) {
        break;
      }
    }
  }

  // 3. Remove multiple spaces (in case there were line breaks) and trim
  const cleanText = pureText.replace(/\s+/g, ' ').trim();

  if (cleanText.length > maxLength) {
    // Truncate the text and avoid cutting off in the middle of a word by finding the last space
    const truncated = cleanText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return `${truncated.substring(0, lastSpaceIndex)}...`;
    }
    return `${truncated}...`;
  }

  return cleanText;
}