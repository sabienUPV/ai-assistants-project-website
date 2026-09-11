import { PROJECT_NAME } from "@constants";
import type { TranslationHelper } from "@utils/translation";

/**
 * Gets the SEO title for the current page.
 * @param t Translation helper function for the current locale. You can get this from `Astro.locals.t` in your components or pages.
 * @returns The SEO title.
 */
export function getSeoTitle(t: TranslationHelper): string {
  return t('seo_title', false, PROJECT_NAME);
}

/**
 * Gets the SEO description for the current page.
 * @param t Translation helper function for the current locale. You can get this from `Astro.locals.t` in your components or pages.
 * @returns The SEO description.
 */
export function getSeoDescription(t: TranslationHelper): string {
  return t('seo_description');
}