import { component, type AstroMarkdocConfig } from "@astrojs/markdoc/config";
import type { SchemaAttribute } from "@markdoc/markdoc";
import { slideAlignValues, type SlideSchema } from "./schemas/slide";
import type { ImageSchema } from "./schemas/image";

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
    children: ['slide']
  },
  slide: {
    description: "Define a single slide for a slideshow component.",
    attributes: {
      title: {
        type: String,
        description: "The title of the slide.",
      },
      align: {
        type: String,
        description: "The alignment of the slide.",
        default: "center" satisfies SlideSchema['align'],
        matches: [...slideAlignValues],
      },
    } satisfies Record<keyof SlideSchema, SchemaAttribute>,
  },
  columns: {
    description: "Render a columns layout component with the provided column children.",
    children: ['column']
  },
  column: {
    description: "Define a single column for a columns layout component.",
  },
  // Note: We cannot call it "image" because Keystatic already has a built-in "image" component, so we call it "customImage" just for Markdoc and Keystatic
  // (but in the UI and Astro component we still call it "Image" for clarity)
  customImage: {
    description: "Render an optimized image component, allowing for further customization (e.g. width, height).",
    attributes: {
      image: {
        type: String,
        required: true,
        description: "The image to display.",
      },
      alt: {
        type: String,
        required: true,
        description: "The alternative text for the image.",
      },
      title: {
        type: String,
        description: "The title of the image.",
      },
      width: {
        type: Number,
        description: "The width of the image in pixels.",
      },
      height: {
        type: Number,
        description: "The height of the image in pixels.",
      },
      cropTop: {
        type: Number,
        description: "Percentage to crop from the top side of the image (0-100).",
      },
      cropRight: {
        type: Number,
        description: "Percentage to crop from the right side of the image (0-100).",
      },
      cropBottom: {
        type: Number,
        description: "Percentage to crop from the bottom side of the image (0-100).",
      },
      cropLeft: {
        type: Number,
        description: "Percentage to crop from the left side of the image (0-100).",
      },
    } satisfies Record<keyof ImageSchema, SchemaAttribute>,
  },
  quiz: {
    description: "Render a quiz component with the provided questions.",
    children: ['question']
  },
  question: {
    description: "Define a single question for a quiz component.",
    attributes: {
      prompt: {
        type: String,
        required: true,
        description: "The question text.",
      },
      answers: {
        type: Array,
        required: true,
        description: "The possible answers to the question.",
      },
    },
  },
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
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Flag.astro'),
    },
    slideshow: {
      ...markdocTagAttributes.slideshow,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Slideshow.astro'),
    },
    slide: {
      ...markdocTagAttributes.slide,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Slide.astro'),
    },
    columns: {
      ...markdocTagAttributes.columns,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Columns.astro'),
    },
    column: {
      ...markdocTagAttributes.column,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Column.astro'),
    },
    customImage: {
      ...markdocTagAttributes.customImage,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Image.astro'),
    },
    quiz: {
      ...markdocTagAttributes.quiz,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Quiz.astro'),
    },
    question: {
      ...markdocTagAttributes.question,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Question.astro'),
    },
  } satisfies AstroMarkdocConfig['tags'] & MarkdocTagsFromAttributes;
}

/**
 * Calculates relative path adjustments across packages inside the monorepo infrastructure.
 */
function getPathPrefixAcrossProjects(fromProject: Project, toProject: Project): string {
  return fromProject === toProject ? './' : `../${toProject}/`;
}