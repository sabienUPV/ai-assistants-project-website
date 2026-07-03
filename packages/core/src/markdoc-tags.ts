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
  // NOTE: You should use markdocTagAttributes directly for the base tag definitions,
  // and only use this function when you need to resolve the paths for rendering components across different projects in the monorepo
  // (e.g. in the render attribute), because we need that to be resolved at runtime based on the project that is consuming the Markdoc configuration.
  return Object.assign({}, markdocTagAttributes, {
    flag: {
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/MarkdocFlag.astro'),
    }
  });
}

/**
 * Calculates relative path adjustments across packages inside the monorepo infrastructure.
 */
function getPathPrefixAcrossProjects(fromProject: Project, toProject: Project): string {
  return fromProject === toProject ? './' : `../${toProject}/`;
}