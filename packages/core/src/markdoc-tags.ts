import { component, Markdoc, type AstroMarkdocConfig } from "@astrojs/markdoc/config";
import type { SchemaAttribute } from "@markdoc/markdoc";
import { slideAlignValues, type SlideSchema } from "./schemas/slide";
import type { ImageContainerSchema } from "./schemas/image";

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
        default: "left" satisfies SlideSchema['align'],
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
  imageContainer: {
    description: "Set an image container to be able to customize the given image (e.g. width, height, crop). Important: You must ONLY provide a SINGLE image inside this container. Anything else will be ignored and not rendered on the website.",
    attributes: {
      title: {
        type: String,
        description: "The title of the image, for accessibility purposes (e.g. 'A beautiful landscape').",
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
    } satisfies Record<keyof ImageContainerSchema, SchemaAttribute>,
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
  arasaac: {
    description: "Render an ARASAAC pictogram dynamically directly from their API.",
    attributes: {
      id: { 
        type: String, 
        required: true, 
        description: "The ID of the pictogram from the ARASAAC website URL (e.g., '39705'). [How to find the ID: Go to https://arasaac.org/pictograms/search, search for the pictogram you want, click on it, and look at the URL in your browser. Example: For https://arasaac.org/pictograms/en/39705/AI, '39705' is the ID you need to use]"
      },
      alt: { 
        type: String, 
        required: true, 
        description: "Alternative text for accessibility (e.g., 'AI brain pictogram')." 
      },
      size: { 
        type: Number, 
        description: "The width and height of the pictogram in pixels (defaults to 150).",
        default: 150,
        validate: (value: number) => {
          if (value <= 0 || value > 2500) {
            return [{
              id: 'invalid-arasaac-size',
              level: 'error',
              message: 'Size must be between 1 and 2500 pixels.'
            }];
          }
          return []; // An empty array means no validation errors
        }
      }
    }
  },
  youtubeVideo: {
    description: "Insert a YouTube video into the content.",
    attributes: {
      videoId: {
        type: String,
        required: true,
        description: "The unique identifier for the YouTube video (e.g., 'dQw4w9WgXcQ'). The ID can be found at the end of the URL of the video.",
      },
      title: {
        type: String,
        description: "The title of the YouTube video for accessibility purposes.",
      },
    }
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
    imageContainer: {
      ...markdocTagAttributes.imageContainer,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Image.astro'),
      attributes: {
        ...markdocTagAttributes.imageContainer.attributes,
        /* We add here the attributes that will be extracted from the child image inside the container, so that they can be passed to the Image.astro component for rendering. Since this is automatic, we don't want them to be in markdocTagAttributes, since it's not meant for the user to see */
        imageSrc: {
          type: String
        },
        alt: {
          type: String
        },
      },
      transform(node, config) {
        // Obtain the attributes that the user configured in Keystatic (width, cropTop, etc.)
        const attributes = node.transformAttributes(config);

        console.log('imageContainer node:', node);
        console.log('imageContainer attributes:', attributes);
        
        let childImageSrc = null;
        let childImageAlt = null;

        // Recursive function to find the first markdown image inside the container and extract its src and alt attributes.
        // Any other elements inside, including other images, will be ignored.
        function findImage(n : typeof node) {
          console.log('findImage node:', n);
          if (n.type === 'image') {
            childImageSrc = n.attributes.src;
            childImageAlt = n.attributes.alt;
            return true;
          }
          if (n.children) {
            for (const child of n.children) {
              if (findImage(child)) return true;
            }
          }
          return false;
        }

        findImage(node);

        console.log('childImageSrc:', childImageSrc);
        console.log('childImageAlt:', childImageAlt);

        console.log('Render:', this.render);

        // Return a new Tag node for Astro,
        // merging the crop attributes with the src of the image.
        const newTag = new Markdoc.Tag(
          'imageContainer',
          {
            ...attributes,
            imageSrc: childImageSrc,
            alt: childImageAlt,
          },
          [] // By returning an empty array, we ensure that the original children of the imageContainer are not rendered, effectively ignoring any other content inside the container. And because we are adding the image src and alt as attributes to the imageContainer tag, the Image.astro component can then render the image with the specified attributes.
        );
        console.log('New tag:', newTag);
        return newTag;
      }
    },
    quiz: {
      ...markdocTagAttributes.quiz,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Quiz.astro'),
    },
    question: {
      ...markdocTagAttributes.question,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/Question.astro'),
    },
    arasaac: {
      ...markdocTagAttributes.arasaac,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/entries/courses/ArasaacPictogram.astro'),
    },
    youtubeVideo: {
      ...markdocTagAttributes.youtubeVideo,
      render: component(getPathPrefixAcrossProjects(fromProject, 'web') + 'src/components/Markdoc/YouTubeVideo.astro'),
    },
  } satisfies AstroMarkdocConfig['tags'] & MarkdocTagsFromAttributes;
}

/**
 * Calculates relative path adjustments across packages inside the monorepo infrastructure.
 */
function getPathPrefixAcrossProjects(fromProject: Project, toProject: Project): string {
  return fromProject === toProject ? './' : `../${toProject}/`;
}