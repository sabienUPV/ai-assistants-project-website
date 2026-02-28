// a11y (accessibility) utilities and constants

import { PROJECT_NAME, PROJECT_NAME_FOR_SCREEN_READERS } from "@constants";

/**
 * Helper constant with accessible HTML for the project name, including a visually hidden version for screen readers.
 * @returns The accessible HTML displaying the project name
 */
export const PROJECT_NAME_HTML = htmlTextWithScreenReaderSupport(PROJECT_NAME, PROJECT_NAME_FOR_SCREEN_READERS);

/**
 * Create accessible HTML that contains both the original text and a descriptive label for screen readers.
 * @param text The original text, as displayed on the screen
 * @param screenReaderText The adapted text so screen readers read it pronouncing it properly. It doesn't need to make sense visually, but it should be clear for screen readers.
 * @returns The resulting HTML containing both versions of the text
 */
export function htmlTextWithScreenReaderSupport(text: string, screenReaderText: string): string {
  return `<span aria-label="${screenReaderText}">${text}</span>`;
}

/**
 * Checks if a link corresponds to the current page for accessibility purposes.
 * Ignores anchor links (#) to prevent multiple "aria-current" attributes,
 * with an exception for "#top" (or empty anchors) which represent the top of the page itself.
 *
 * @param currentPath The current path (usually Astro.url.pathname)
 * @param href The target URL of the link
 * @returns "page" if it's the current page, undefined otherwise
 */
export function getAriaCurrentPage(currentPath: string, href: string): "page" | undefined {
  // 1. Remove trailing slashes to match "/en/" with "/en"
  const normalizedPath = currentPath.replace(/\/$/, '') || '/';
  
  // 2. Separate the base href from its potential anchor (#)
  const [baseHref, anchor] = href.split('#');
  const normalizedBaseHref = baseHref.replace(/\/$/, '') || '/';

  // 3. Check if the anchor is just sending us back to the top of the page
  const isTopAnchor = anchor === 'top' || anchor === '';

  // 4. If there is an anchor and it is NOT the top anchor, it's never the "current page"
  // (whether it's a section on this page or a section on another page entirely)
  if (anchor !== undefined && !isTopAnchor) {
    return undefined; 
  }

  // 5. If the base paths match exactly, it is the current page
  return normalizedPath === normalizedBaseHref ? "page" : undefined;
}