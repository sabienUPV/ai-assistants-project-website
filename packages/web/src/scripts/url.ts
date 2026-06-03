import { locales } from "@languages";
import { tryRemoveBaseUrlFromPath } from "@utils/url";

// IMPORTANT: Since Astro 6, we can no longer import server-side only modules like astro:i18n in client-side scripts.
// So we can no longer import @utils/localizedUrl here directly, since it depends on astro:i18n for some of its functions.

/**
 * Extracts the locale from the given path. It checks if the path starts with any of the supported locales.
 * If it does, it returns that locale. If not, it returns null.
 * It also handles the case where the path might include the baseUrlPath (e.g., for deployments in subfolders like GitHub Pages) by first removing it before checking for locales.
 */
export function extractLocaleFromPath(path: string): string | null {
  // First, try to remove the baseUrlPath if it exists (e.g., for deployments in subfolders like GitHub Pages)
  const cleanPath = tryRemoveBaseUrlFromPath(path);

  // Check if the pathname starts with any of the supported locales
  return locales.find(locale => cleanPath === `/${locale}` || cleanPath.startsWith(`/${locale}/`)) || null;
}