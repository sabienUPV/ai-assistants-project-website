/**
 * Base path for the site, normalized to be always WITHOUT a trailing slash to ensure consistent URL construction
 */
export const baseUrlPath = import.meta.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash from BASE_URL if it exists

/**
 * Proper way to reference the homepage or subpaths
 * 
 * NOTE: This is NOT locale-aware.
 * For that, either use the homeLocale helper function from Astro.locals (which we set up in middleware.ts),
 * or if you already have the locale available, use the getRelativeLocaleUrl function from "astro:i18n" directly (never on a client-side script though, since astro:i18n is a server-side only module).
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
  return `${baseUrlPath}${validPath}`;
};

/**
 * Remove {@link baseUrlPath} from the start of the path if it exists (e.g., for deployments in subfolders like GitHub Pages)
 */
export function tryRemoveBaseUrlFromPath(path: string): string {
  if (baseUrlPath && path.startsWith(baseUrlPath)) {
    return path.slice(baseUrlPath.length);
  }
  return path;
}

/**
 * Get the absolute URL path to a sibling page, preserving the current locale and any other path segments.
 * 
 * Example:
 * ("/es/courses/unidad-1", "unidad-2") => "/es/courses/unidad-2"
 * 
 * This function is needed because if you use a relative path like "unit-2" in a link, the browser will do it properly only if the URL does NOT end with a slash (/). Because if it does, the browser thinks the page is a "directory", and will append the relative path to that directory instead of replacing the last segment. This function ensures that the last segment is replaced correctly, regardless of whether the current URL ends with a slash or not, and returns the resulting absolute path so the browser cannot misinterpret it.
 * 
 * @param astroUrlPathName The value of `Astro.url.pathname` (you can access it from your Astro page or component)
 * @param relativePath The relative path to the sibling page you want to link to (e.g., "unit-2" or "unit-3")
 * @returns The absolute URL path to the sibling page, preserving the current locale and any other path segments
 */
export function getSiblingUrl(astroUrlPathName: string, relativePath: string): string {
  // Remove any trailing slash from the current URL path to avoid double slashes when joining
  const cleanPath = astroUrlPathName.replace(/\/$/, '');
  
  // Break down the URL into segments: ['', 'es', 'courses', 'unit-1']
  const segments = cleanPath.split('/');
  
  // Remove leading slash from relative path if present
  const newRelativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  if (segments.length < 2) {
    // If there are no segments (or only the root ('/')), just return the new slug with a leading slash
    return `/${newRelativePath}`;
  }

  // Replace the last segment with the new relative path (e.g., "unidad-2")
  segments[segments.length - 1] = newRelativePath;
  
  // Join the segments back together to form the new URL path (e.g., "/es/courses/unidad-2")
  return segments.join('/');
}