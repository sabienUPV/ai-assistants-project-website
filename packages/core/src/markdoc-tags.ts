import { component, type AstroMarkdocConfig } from "@astrojs/markdoc/config";

type Project = 'web' | 'admin';

/**
 * Single source of truth for all Markdoc tag definitions.
 * Using 'satisfies' validates conformity with Astro's types without widening the shape,
 * which preserves exact property types and descriptions for downstream consumption.
 */
export const markdocTagAttributes = {
  flag: {
    attributes: {
      country: { 
        type: String, 
        required: true,
        description: "The country code: 'eu', 'es', etc. You can find a list of supported country codes here: https://icon-sets.iconify.design/circle-flags/",
      }
    },
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
      // // which is why we need to re-include its attributes)
      ...markdocTagAttributes.flag,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/MarkdocFlag.astro'),
    }
  };
}

/**
 * Calculates relative path adjustments across packages inside the monorepo infrastructure.
 */
function getPathPrefixAcrossProjects(fromProject: Project, toProject: Project): string {
  return fromProject === toProject ? './' : `../${toProject}/`;
}