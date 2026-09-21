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
 * Get the URL to the first page of the main content (e.g., "/1") for the current locale, for use with Astro.rewrite so the main content page (e.g., "/courses") will show the same as first page of the content (e.g., "/courses/1") without requiring a separate request from the client.
 *
 * (Note: Astro.rewrite is NOT the same as Astro.redirect, since we are not redirecting the user to a different URL, we are just rewriting the URL to point to a different page, so it only makes one request to the server instead of two, which is what would happen if we used Astro.redirect)
 * 
 * @example
 * // Example usage in an Astro page
 * // (not meant for components, since Astro.rewrite is only for pages)
 * ---
 * import { getStaticPathsFromLocales as getStaticPaths } from '@utils/translation';
 * import { getFirstPageRewriteUrl } from '@utils/url';
 * 
 * export { getStaticPaths };
 * 
 * return Astro.rewrite(getFirstPageRewriteUrlPath(Astro.url.pathname, "list"));
 * ---
 * 
 * @param baseUrlPath The base URL path. Typically, the current URL path, obtained with `Astro.url.pathname` in an Astro page or component. It should be a string that starts with a slash (e.g., "/es/courses/unidad-1").
 * @param subpath Optional subpath to append to the URL (e.g., "list"). If provided, the function will return the URL to the first page of that subpath (e.g., for "/es/courses", "/es/courses/list/1"). If not provided, it will return the URL to the first page of the main content (e.g., "/es/courses/1").
 * @returns A string representing the URL pointing to the first page of the main content (e.g., "/en/courses/1") for the current locale, for use with Astro.rewrite
 */
export function getFirstPageRewriteUrlPath(baseUrlPath: string, subpath?: string): string {
  // If there is a subpath, we clean it up by removing any leading or trailing slashes for safety
  const cleanSubpath = subpath ? subpath.replace(/^\/+|\/+$/g, '') : '';

  // We build the relative path depending on whether there is a subpath or not
  const targetPath = cleanSubpath ? `${cleanSubpath}/1` : "1";
  
  return applyRelativePathToBaseUrlPath(baseUrlPath, targetPath, 'append');
}

/**
 * Get the absolute URL path to a sibling page, preserving the current locale and any other path segments.
 * 
 * This function is needed because if you use a relative path like "unit-2" in a link, the browser will do it properly only if the URL does NOT end with a slash (/). Because if it does, the browser thinks the page is a "directory", and will append the relative path to that directory instead of replacing the last segment. This function ensures that the last segment is replaced correctly, regardless of whether the current URL ends with a slash or not, and returns the resulting absolute path so the browser cannot misinterpret it.
 * 
 * @example
 * // Usage in an Astro page/component
 * // Astro.url.pathname = "/es/courses/unidad-1"
 * getSiblingUrlPath(Astro.url.pathname, "unidad-2") // => "/es/courses/unidad-2"
 * 
 * @param baseUrlPath The base URL path. Typically, the current URL path, obtained with `Astro.url.pathname` in an Astro page or component. It should be a string that starts with a slash (e.g., "/es/courses/unidad-1").
 * @param relativePath The relative path to the sibling page you want to link to (e.g., "unit-2" or "unit-3")
 * @returns The absolute URL path to the sibling page, preserving the current locale and any other path segments
 */
export function getSiblingUrlPath(baseUrlPath: string, relativePath: string): string {
  return applyRelativePathToBaseUrlPath(baseUrlPath, relativePath, 'replace');
}

/**
 * Get the absolute URL path to a child page, appending it to the current path segments.
 * 
 * @param baseUrlPath The base URL path. Typically, the current URL path, obtained with `Astro.url.pathname` in an Astro page or component. It should be a string that starts with a slash (e.g., "/es/courses/unidad-1").
 * @param relativePath The relative path to the child page you want to link to (e.g., "unidad-2" or "unidad-3").
 * @returns The absolute URL path to the child page, preserving the current locale and any other path segments.
 */
export function getChildUrlPath(baseUrlPath: string, relativePath: string): string {
  return applyRelativePathToBaseUrlPath(baseUrlPath, relativePath, 'append');
}

type RelativePathOperation = 'replace' | 'append';

/**
 * Applies a relative path to a base URL path, either replacing the last segment or appending the new path.
 * @param baseUrlPath The base URL path. Typically, the current URL path, obtained with `Astro.url.pathname` in an Astro page or component. It should be a string that starts with a slash (e.g., "/es/courses/unidad-1").
 * @param relativePath The relative path to apply (e.g., "unidad-2" or "unidad-3").
 * @param operationValueOrFn The operation to perform. It can be a string ('replace' or 'append') or a function that takes the segments and returns the operation.
 * @returns The new URL path with the relative path applied, always ending with a trailing slash (e.g., "/es/courses/unidad-2/").
 */
function applyRelativePathToBaseUrlPath(baseUrlPath: string, relativePath: string, operationValueOrFn: RelativePathOperation | ((segments: string[]) => RelativePathOperation)): string {
  // Remove any trailing slash from the base URL path to avoid double slashes when joining
  const cleanPath = baseUrlPath.replace(/\/$/, '');
  
  // Break down the URL into segments: ['', 'es', 'courses', 'unit-1']
  const segments = cleanPath.split('/');
  
  // Remove leading slash from relative path if present
  const newRelativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  if (segments.length < 2) {
    // If there are no segments (or only the root ('/')), just return the new slug with a leading slash and trailing slash
    return `/${newRelativePath}/`;
  }

  // We allow two modes: either saying the operation directly, or providing a function that takes the segments and returns the operation.
  // This allows for more complex logic (such as, in getAbsoluteUrlFromRelativePathWithoutPageNumber, where we only want to replace the last segment if it is a page number, otherwise we want to append the new relative path).
  const actualOperation = typeof operationValueOrFn === 'function' ? operationValueOrFn(segments) : operationValueOrFn;

  switch (actualOperation) {
    case 'replace':
      // Replace the last segment with the new relative path (e.g., "unidad-2")
      segments[segments.length - 1] = newRelativePath;
      break;
    case 'append':
      // Append the new relative path as a new segment
      segments.push(newRelativePath);
      break;
    default:
      throw new Error(`Unsupported operation: ${actualOperation}`);
  }
  
  // Join the segments back together to form the new URL path, guaranteeing a trailing slash (e.g., "/es/courses/unidad-2/")
  return `${segments.join('/')}/`;
}

/**
 * Extracts the base content directory path by stripping any search or pagination suffixes.
 * Useful for building absolute URLs for child entries (like posts or courses).
 * Example: "/es/blog/list/2/" -> "/es/blog/"
 * 
 * @example
 * // Usage in an Astro page/component
 * // Astro.url.pathname = "/es/courses/unidad-1"
 * const basePath = getBaseDirectoryUrlPath(Astro.url.pathname); // => "/es/courses/"
 * const postUrl = getChildUrlPath(basePath, getSlugFromEntryId(post.id)); // => "/es/courses/unit-1"
 * 
 * @see getChildUrlPath for building child entry URLs based on this base path.
 * @param astroUrlPathname The current pathname from `Astro.url.pathname`
 * @returns The base content directory path, always ending with a trailing slash
 */
export function getBaseDirectoryUrlPath(astroUrlPathname: string): string {
  let basePath = astroUrlPathname.endsWith('/') ? astroUrlPathname : `${astroUrlPathname}/`;
  
  // Strip both /search/ and ANY /list/.../ suffix completely
  return basePath
    .replace(/\/search\/$/, '/')
    .replace(/\/list(\/\d+)?\/?$/, '/');
}

export function getUrlFriendlyVersionOfString(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD') // Normalize accented characters to their decomposed form
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks (accents)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove any non-alphanumeric characters (except hyphens)
    .replace(/--+/g, '-') // Replace multiple hyphens with a single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
}

/**
 * Builds the canonical path for SEO optimization.
 * 
 * SEO Best Practices for Pagination:
 * - We canonicalize the first page of results (/list/, /list/1/, /search/) back to the root directory (e.g., /blog/).
 * - We keep deeper paginated pages (/list/2/, /list/3/) as self-referencing canonicals.
 * If we canonicalized ALL pages to the root, search engines would drop deeper pages from the index
 * and stop crawling older articles, causing a severe drop in discoverability.
 * 
 * @param astroUrlPathname The current pathname from `Astro.url.pathname`
 * @returns The clean, canonicalized path always ending with a trailing slash
 */
export function getCanonicalUrlPath(astroUrlPathname: string): string {
  // 1. Force a trailing slash to standardize the path and avoid double-slash issues
  let canonicalPath = astroUrlPathname.endsWith('/') 
    ? astroUrlPathname 
    : `${astroUrlPathname}/`;

  // 2. Canonicalize the search page back to the root
  // Turns "/es/blog/search/" into "/es/blog/"
  canonicalPath = canonicalPath.replace(/\/search\/$/, '/');

  // 3. Canonicalize the first page of the list back to the root
  // Turns both "/es/blog/list/" and "/es/blog/list/1/" into "/es/blog/"
  // The regex matches "/list/" optionally followed by "1/", but ignores "2/", "3/", etc.
  canonicalPath = canonicalPath.replace(/\/list\/(1\/)?$/, '/');

  // Any other page (like "/es/blog/list/2/") will pass through untouched,
  // creating the correct self-referencing canonical for deep pagination.
  
  return canonicalPath;
}