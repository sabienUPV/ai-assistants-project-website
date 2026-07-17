import type { AstroGlobal } from "astro";

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
 * @param astroUrlPathname The value of `Astro.url.pathname` (you can access it from your Astro page or component)
 * @param subpath Optional subpath to append to the URL (e.g., "list"). If provided, the function will return the URL to the first page of that subpath (e.g., for "/en/courses", "/en/courses/list/1"). If not provided, it will return the URL to the first page of the main content (e.g., "/en/courses/1").
 * @returns The URL object pointing to the first page of the main content (e.g., "/en/courses/1") for the current locale, for use with Astro.rewrite
 */
export function getFirstPageRewriteUrlPath(astroUrlPathname: string, subpath?: string): string {
  // Si nos pasan un subpath, le quitamos las barras iniciales o finales por seguridad
  const cleanSubpath = subpath ? subpath.replace(/^\/+|\/+$/g, '') : '';
  
  // Construimos el path relativo dependiendo de si hay subpath o no
  const targetPath = cleanSubpath ? `./${cleanSubpath}/1` : "./1";
  
  return applyRelativePathToCurrentUrlPath(astroUrlPathname, targetPath, 'append');
}

/**
 * Get the absolute URL path to a sibling page, preserving the current locale and any other path segments.
 * 
 * This function is needed because if you use a relative path like "unit-2" in a link, the browser will do it properly only if the URL does NOT end with a slash (/). Because if it does, the browser thinks the page is a "directory", and will append the relative path to that directory instead of replacing the last segment. This function ensures that the last segment is replaced correctly, regardless of whether the current URL ends with a slash or not, and returns the resulting absolute path so the browser cannot misinterpret it.
 * 
 * @example
 * // Usage in an Astro page/component
 * // Astro.url.pathname = "/es/courses/unidad-1"
 * getSiblingUrl(Astro.url.pathname, "unidad-2") // => "/es/courses/unidad-2"
 * 
 * @param astroUrlPathName The value of `Astro.url.pathname` (you can access it from your Astro page or component)
 * @param relativePath The relative path to the sibling page you want to link to (e.g., "unit-2" or "unit-3")
 * @returns The absolute URL path to the sibling page, preserving the current locale and any other path segments
 */
export function getSiblingUrl(astroUrlPathName: string, relativePath: string): string {
  return applyRelativePathToCurrentUrlPath(astroUrlPathName, relativePath, 'replace');
}

/**
 * Get the absolute URL path to a child page, preserving the current locale and any other path segments.
 * 
 * This function handles cases where the current URL ends with a page number (e.g., "/es/courses/1") by replacing that number with the new relative path (e.g., "/es/courses/unit-2"), to prevent the wrong URL (e.g., "/es/courses/1/unit-2") from being inferred by the browser from the relative path.
 * 
 * @example
 * // Usage in an Astro page/component
 * // Astro.url.pathname = "/es/courses/1"
 * getAbsoluteUrlFromRelativePathWithoutPageNumber(Astro.url.pathname, "unit-2") // => "/es/courses/unit-2"
 * 
 * @param astroUrlPathName The value of `Astro.url.pathname` (you can access it from your Astro page or component)
 * @param relativePath The relative path to the child page you want to link to (e.g., "unit-2" or "unit-3")
 * @returns The absolute URL path to the child page, preserving the current locale and any other path segments
 */
export function getAbsoluteUrlFromRelativePathWithoutPageNumber(astroUrlPathName: string, relativePath: string): string {
  return applyRelativePathToCurrentUrlPath(astroUrlPathName, relativePath, (segments) => {
    // If the last segment is a number (indicating a page number), we want to replace it with the new relative path
    const lastSegment = segments[segments.length - 1];
    if (/^\d+$/.test(lastSegment)) {
      return 'replace';
    }
    // Otherwise, we want to append the new relative path as a new segment
    return 'append';
  });
}

type RelativePathOperation = 'replace' | 'append';
function applyRelativePathToCurrentUrlPath(astroUrlPathName: string, relativePath: string, operationValueOrFn: RelativePathOperation | ((segments: string[]) => RelativePathOperation)): string {
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

  // We allow two modes: either saying the operation directly, or providing a function that takes the segments and returns the operation.
  // This allows for more complex logic (such as, in getAbsoluteUrlFromRelativePathWithoutPageNumber, where we only want to replace the last segment if it is a page number, otherwise we want to append the new relative path).
  let actualOperation;
  if (typeof operationValueOrFn === 'function') {
    actualOperation = operationValueOrFn(segments);
  }
  else {
    actualOperation = operationValueOrFn;
  }

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
  
  // Join the segments back together to form the new URL path (e.g., "/es/courses/unidad-2")
  return segments.join('/');
}