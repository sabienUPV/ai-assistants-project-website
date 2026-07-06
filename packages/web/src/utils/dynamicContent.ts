import { defaultLocale, type Locale } from '@languages';
import Markdoc from '@markdoc/markdoc';
import type { Course, Post } from '@sabien-upv-astro-cms/core';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

type DynamicContentCollectionName = 'posts' | 'courses';
type DynamicContentEntry<Name extends DynamicContentCollectionName, Data extends Record<string, unknown>> = CollectionEntry<`${Name}_${Locale}`> & { data: Data };

export type PostEntry = DynamicContentEntry<'posts', Post>;
export type CourseEntry = DynamicContentEntry<'courses', Course>;

// Helper functions for dynamic content (e.g. blog posts)

export type CollectionWithFallbacksResult<Collection extends DynamicContentEntry<DynamicContentCollectionName, Data>, Data extends Record<string, unknown>> = {
  collection: Collection[],
  fallbackIds?: string[],
};

// Overload declarations: Turns out that in TypeScript you can declare multiple function signatures for the same function name, allowing you to specify different parameter types and return types based on the input, WITHOUT having to write separate functions or change the implementation.
// This won't be read by JavaScript, and only used by TypeScript for type-checking.
// What this allows is TypeScript to automatically infer that if you pass 'posts' as the collectionName, the return type will be PostEntry[], and if you pass 'courses', the return type will be CourseEntry[], WITHOUT having to manually specify the Data generic type parameter when calling the function. This makes the function easier to use and reduces the chance of type errors.
export async function getCollectionWithFallbacks(collectionName: 'posts', locale: Locale): Promise<CollectionWithFallbacksResult<PostEntry, Post>>;
export async function getCollectionWithFallbacks(collectionName: 'courses', locale: Locale): Promise<CollectionWithFallbacksResult<CourseEntry, Course>>;

export async function getCollectionWithFallbacks<Data extends Record<string, unknown>>(collectionName: DynamicContentCollectionName, locale: Locale): Promise<CollectionWithFallbacksResult<DynamicContentEntry<DynamicContentCollectionName, Data>, Data>> {
  // Fetch all entries from the specified collection in the current locale
  const currentLocaleEntries = await getCollection(`${collectionName}_${locale}`) as DynamicContentEntry<DynamicContentCollectionName, Data>[];

  // If the current locale is the default locale, we don't need to fetch fallbacks
  if (locale === defaultLocale) {
    return { collection: currentLocaleEntries };
  }

  // Create a map of current locale entries for quick lookup by slug
  const currentLocaleEntriesMap = new Map<string, DynamicContentEntry<DynamicContentCollectionName, Data>>();
  for (const entry of currentLocaleEntries) {
    currentLocaleEntriesMap.set(getSlugFromEntryId(entry.id), entry);
  }

  // Fetch all entries from the specified collection in the default locale
  const defaultLocaleEntries = await getCollection(`${collectionName}_${defaultLocale}`) as DynamicContentEntry<DynamicContentCollectionName, Data>[];

  // Combine entries from the current locale with fallbacks from the default locale
  const fallbackIds: string[] = [];
  const combinedEntries: DynamicContentEntry<DynamicContentCollectionName, Data>[] = [];
  for (const defaultEntry of defaultLocaleEntries) {
    const slug = getSlugFromEntryId(defaultEntry.id);
    const isMissingInCurrentLocale = !currentLocaleEntriesMap.has(slug);
    if (isMissingInCurrentLocale) {
      fallbackIds.push(defaultEntry.id);
      combinedEntries.push(defaultEntry);
    }
  }

  return { collection: combinedEntries, fallbackIds };
}

// More overload declarations for getEntryOrFallbackFromSlug to allow TypeScript to infer the correct return type based on the collectionName parameter (see above in getCollectionWithFallbacks for an in-depth explanation)
export async function getEntryOrFallbackFromSlug(collectionName: 'posts', locale: Locale, slug: string): Promise<PostEntry | undefined>;
export async function getEntryOrFallbackFromSlug(collectionName: 'courses', locale: Locale, slug: string): Promise<CourseEntry | undefined>;

export async function getEntryOrFallbackFromSlug<Data extends Record<string, unknown>>(collectionName: DynamicContentCollectionName, locale: Locale, slug: string): Promise<DynamicContentEntry<DynamicContentCollectionName, Data> | undefined> {
  // Try to get the entry in the current locale
  const entryId = getEntryIdFromSlug(locale, collectionName, slug);
  const entry = await getEntry(`${collectionName}_${locale}`, entryId) as DynamicContentEntry<DynamicContentCollectionName, Data> | undefined;
  if (entry) return entry;

  // If not found, try to get the entry in the default locale
  const fallbackEntry = await getEntry(`${collectionName}_${defaultLocale}`, entryId) as DynamicContentEntry<DynamicContentCollectionName, Data> | undefined;
  return fallbackEntry;
}

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