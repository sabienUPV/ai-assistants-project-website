/**
 * Simple schemas for Markdoc tag attributes of common components that can be used anywhere,
 * and do not require any special configuration to warrant making a separate file just for their definition.
 */

export type FlagSchema = {
  /**
   * The country code: 'eu', 'es', etc.
   * You can find a list of supported country codes here: https://icon-sets.iconify.design/circle-flags/
   */
  country: string;
};

export type ArasaacSchema = {
  /**
   * The ID of the pictogram from the ARASAAC website URL (e.g., '39705'). [How to find the ID: Go to https://arasaac.org/pictograms/search, search for the pictogram you want, click * on it, and look at the URL in your browser. Example: For https://arasaac.org/pictograms/en/39705/AI, '39705' is the ID you need to use]
   */
  id: string;
  /**
   * Alternative text for accessibility (e.g., 'AI brain pictogram').
   */
  alt: string;
  /**
   * The width and height of the pictogram in pixels (default: 300) (min: 1, max: 2500).
   */
  size?: number;
};

export type YouTubeVideoSchema = {
  /**
   * The unique identifier (ID) for the YouTube video (e.g., 'dQw4w9WgXcQ'). The ID can be found at the end of the URL of the video.
   */
  videoId: string;
  /**
   * The title of the YouTube video for accessibility purposes.
   */
  title?: string;
}