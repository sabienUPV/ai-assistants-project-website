import { defaultLocale, type Locale } from '@languages';
import Markdoc from '@markdoc/markdoc';
import type { Course, Post } from '@sabien-upv-astro-cms/core';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

type DynamicContentCollectionName = 'posts' | 'courses';
type DynamicContentEntry<Name extends DynamicContentCollectionName, Data extends Record<string, unknown>> = CollectionEntry<`${Name}_${Locale}`> & { data: Data };

export type PostEntry = DynamicContentEntry<'posts', Post>;
export type CourseEntry = DynamicContentEntry<'courses', Course>;

// Helper functions for dynamic content (e.g. blog posts)

export type CollectionWithFallbacksResult<ContentEntry extends DynamicContentEntry<DynamicContentCollectionName, Data>, Data extends Record<string, unknown>> = {
  collection: ContentEntry[],
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
  const combinedEntries: DynamicContentEntry<DynamicContentCollectionName, Data>[] = currentLocaleEntries.slice(); // Start with current locale entries
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

export type EntryOrFallbackResult<ContentEntry extends DynamicContentEntry<DynamicContentCollectionName, Data>, Data extends Record<string, unknown>> = {
  entry: ContentEntry | undefined;
  isFallback: boolean;
}

// More overload declarations for getEntryOrFallbackFromSlug to allow TypeScript to infer the correct return type based on the collectionName parameter (see above in getCollectionWithFallbacks for an in-depth explanation)
export async function getEntryOrFallbackFromSlug(collectionName: 'posts', locale: Locale, slug: string): Promise<EntryOrFallbackResult<PostEntry, Post>>;
export async function getEntryOrFallbackFromSlug(collectionName: 'courses', locale: Locale, slug: string): Promise<EntryOrFallbackResult<CourseEntry, Course>>;

export async function getEntryOrFallbackFromSlug<Data extends Record<string, unknown>>(collectionName: DynamicContentCollectionName, locale: Locale, slug: string): Promise<EntryOrFallbackResult<DynamicContentEntry<DynamicContentCollectionName, Data>, Data>> {
  // Try to get the entry in the current locale
  const entry = await getEntry(`${collectionName}_${locale}`, getEntryIdFromSlug(locale, collectionName, slug)) as DynamicContentEntry<DynamicContentCollectionName, Data> | undefined;
  if (entry) return { entry, isFallback: false };

  // If not found, try to get the entry in the default locale
  const fallbackEntry = await getEntry(`${collectionName}_${defaultLocale}`, getEntryIdFromSlug(defaultLocale, collectionName, slug)) as DynamicContentEntry<DynamicContentCollectionName, Data> | undefined;
  return { entry: fallbackEntry, isFallback: true };
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

// Helper function ONLY for courses
// (Note: we need to have it in a separate file because getStaticPaths cannot get functions defined on top of it in the same component, because apparently Astro runs getStaticPaths in a different context than the rest of the component, so it cannot access functions defined on top of it, which is why we need to have this function in a separate file)
export async function getFirstLevelCourses(locale: Locale): Promise<CollectionWithFallbacksResult<CourseEntry, Course>> {
  // 1. Fetch all entries from the courses collection
  const result = await getCollectionWithFallbacks('courses', locale);

  // 2. Filter courses that are a first-level unit
  result.collection = result.collection.filter(course => course.data.unit.indexOf('.') === -1); // If there's no dot, it's a first-level unit

  return result;
}
