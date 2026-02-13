/**
 * Base path for the site, normalized to be always WITHOUT a trailing slash to ensure consistent URL construction
 */
export const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash from BASE_URL if it exists

/**
 * Proper way to reference the homepage or subpaths
 * 
 * NOTE: This is NOT locale-aware.
 * For that, either use the homeLocale helper function from Astro.locals (which we set up in middleware.ts),
 * or if you already have the locale available, use the getRelativeLocaleUrl function from "astro:i18n" directly.
 * 
 * Handles base paths for GitHub Pages deployments
 * (since default is '/' but GitHub Pages often uses '/repo-name'
 * without the trailing slash, so we account for both cases)
 */
export function homeNoLocale(path: string = ''): string {
  // Ensure the path starts with a slash
  const validPath = path.startsWith('/') ? path : `/${path}`;

  // Combine the base URL with the valid path, ensuring we don't end up with double slashes
  // (e.g. "/my-repo" + "/en/" => "/my-repo/en/")
  return `${baseUrl}${validPath}`;
};