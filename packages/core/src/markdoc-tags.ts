import { component, type AstroMarkdocConfig } from "@astrojs/markdoc/config";

type Project = 'web' | 'admin';
type AstroTagConfig = NonNullable<AstroMarkdocConfig['tags']>[string];
type MarkdocTagsFromAttributes = {
  [K in keyof typeof markdocTagAttributes]: AstroTagConfig;
};

/**
 * Single source of truth for all Markdoc tag definitions.
 * Using 'satisfies' validates conformity with Astro's types without widening the shape,
 * which preserves exact property types and descriptions for downstream consumption.
 */
export const markdocTagAttributes = {
  flag: {
    description: "Render a country flag icon (e.g. 'eu' for European Union, 'es' for Spain, etc.)",
    attributes: {
      country: { 
        type: String,
        required: true,
        description: "The country code: 'eu', 'es', etc. You can find a list of supported country codes here: https://icon-sets.iconify.design/circle-flags/",
      }
    },
  },
  notranslate: {
    description: "Mark content to be ignored by the LLM translation process, and preserved as-is in any translated versions.",
  },
  slideshow: {
    description: "Render a slideshow component with the provided slides.",
    attributes: {
      slides: {
        // This is a dynamic array for Markdoc, but the structure of each slide object in the array will be defined and enforced in the Keystatic configuration
        // (by using the fields.array and fields.object schema definitions, along with satisfies to ensure conformity with the Slide type from core).
        type: Array,
        required: true,
        description: "Array of slide objects",
      }
    }
  }
} satisfies AstroMarkdocConfig['tags'];

/**
 * Generates the full Markdoc tag configuration with resolution paths mapped
 * according to the consuming project location in the monorepo.
 */
export function getMarkdocTags(fromProject: Project = 'web'): AstroMarkdocConfig['tags'] {
  return {
    // Use the spread operator to include all tag definitions from the base configuration
    ...markdocTagAttributes,
    flag: {
      // Use the spread operator to include all attribute definitions for the 'flag' tag
      // we need to do this again because the flag object is being completely replaced here,
      // since the spread operator only does a shallow copy,
      // so redefining the flag property does NOT merge the original flag object with the new one, it replaces it entirely,
      // which is why we need to re-include its attributes
      ...markdocTagAttributes.flag,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/MarkdocFlag.astro'),
    },
    slideshow: {
      ...markdocTagAttributes.slideshow,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/entries/courses/Slideshow.astro'),
    },
  } satisfies AstroMarkdocConfig['tags'] & MarkdocTagsFromAttributes;
}

/**
 * Calculates relative path adjustments across packages inside the monorepo infrastructure.
 */
function getPathPrefixAcrossProjects(fromProject: Project, toProject: Project): string {
  return fromProject === toProject ? './' : `../${toProject}/`;
}