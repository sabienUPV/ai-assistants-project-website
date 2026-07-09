import type { SlideSchema } from "../schemas/slideshow";

export type Slide = SlideSchema & {
  content?: string; // The content field comes from the Slide wrapper component, which allows for rich text content inside the slide. This is optional because not all slides may have additional content beyond the title and image.
};