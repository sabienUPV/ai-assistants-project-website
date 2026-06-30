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