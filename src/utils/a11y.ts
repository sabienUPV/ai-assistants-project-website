// a11y (accessibility) utilities and constants

import { PROJECT_NAME, PROJECT_NAME_FOR_SCREEN_READERS } from "@utils/constants";

/**
 * Helper constant with accessible HTML for the project name, including a visually hidden version for screen readers.
 * @returns The accessible HTML displaying the project name
 */
export const PROJECT_NAME_HTML = htmlTextWithScreenReaderSupport(PROJECT_NAME, PROJECT_NAME_FOR_SCREEN_READERS);

/**
 * Create accessible HTML that contains both the original text and a visually hidden version for screen readers.
 * @param text The original text, as displayed on the screen
 * @param screenReaderText The adapted text so screen readers read it pronouncing it properly. It doesn't need to make sense visually, but it should be clear for screen readers.
 * @returns The resulting HTML containing both versions of the text
 */
export function htmlTextWithScreenReaderSupport(text: string, screenReaderText: string): string {
  return `<span aria-hidden="true">${text}</span><span class="sr-only">${screenReaderText}</span>`;
}