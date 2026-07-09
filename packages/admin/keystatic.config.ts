import { config, fields, collection, type Config, type ComponentSchema } from '@keystatic/core';
import { inline, repeating, wrapper } from '@keystatic/core/content-components';
import type { Post, Course } from '@sabien-upv-astro-cms/core';
import { courseUnitRegex, courseUnitValidationMessage, markdocTagAttributes } from '@sabien-upv-astro-cms/core';
import React from 'react';
import { locales, type Locale } from '@languages';
import type { SlideSchema } from '@schemas/slideshow';

// 1. CREAMOS EL TIPO MAPEADO
// Le exigimos a TS que este objeto tenga obligatoriamente todas las keys de tu Post de Zod.
// Usamos `any` como valor porque no nos importa el tipo interno de Keystatic (fields.text, etc.),
// solo nos importa que la KEY (title, author, pubDate) exista.
type KeystaticPostSchema = {
  [K in keyof Post]: ComponentSchema; 
} & {
  content: ComponentSchema; // We add 'content' because Keystatic requires it for Markdoc
};
type KeystaticCourseSchema = {
  [K in keyof Course]: ComponentSchema; 
} & {
  content: ComponentSchema;
};

// Define custom components for Keystatic using shared core attributes
const flagComponent = inline({
  label: 'Flag',
  description: markdocTagAttributes.flag.description,
  schema: {
    // Safely accessing the description metadata from the shared core configuration for consistency
    country: fields.text({ 
      label: 'Country Code (e.g., eu, es)', 
      description: markdocTagAttributes.flag.attributes.country.description 
    }),
  },
  // Customizing how the inline tag looks inside the editor canvas
  ContentView: (props) => {
    // 'props.value' contains the current state of our schema fields
    const countryCode = props.value?.country || '...';
    
    return React.createElement(
      'span',
      { style: { color: '#0284c7', fontWeight: 'bold' } },
      `🚩 flag: '${countryCode}'`
    );
  }
});
const noTranslateComponent = wrapper({
  label: 'No Translate',
  description: markdocTagAttributes.notranslate.description,
  schema: {}, // Empty, because the content is its own content
  ContentView: (props) => {
    return React.createElement('div', {}, props.children);
  }
});
const slideshowComponent = repeating({
  label: 'Slideshow',
  description: markdocTagAttributes.slideshow.description,
  children: ['slide'], // Only allow slide components. This should match the tag name for slides
  schema: {}, // No additional fields for the slideshow itself, just the slides
});
const slideComponent = wrapper({
  label: 'Slide',
  description: markdocTagAttributes.slide.description,
  schema: {
    title: fields.text({ label: 'Title' }),
    image: fields.text({ label: 'Image URL' }),
    alt: fields.text({ label: 'Alt Text' }),
  } satisfies Record<keyof SlideSchema, ComponentSchema>, // Ensure all Slide fields are present
  // ContentView: (props) => {
  //   const { title, image, alt, text } = props.value || {};
  //   return React.createElement(
  //     'div',
  //     { style: { border: '1px solid #ccc', padding: '8px', marginBottom: '8px' } },
  //     React.createElement('h4', {}, title || 'No Title'),
  //     image && React.createElement('img', { src: image, alt: alt || '', style: { maxWidth: '100%' } }),
  //     text && React.createElement('div', {}, props.children)
  //   );
  // }
});

// Select storage kind based on environment variable:
// - In local development, we default to 'local' storage for simplicity.
// - In production, we default to 'cloud' storage (Keystatic Cloud) to deploy directly to the production environment (the GitHub repository).
// If we manually set the environment variable KEYSTATIC_STORAGE_LOCAL to 'true' or 'false', it will override the defaults.
const isLocal = import.meta.env.KEYSTATIC_STORAGE_LOCAL 
  ? import.meta.env.KEYSTATIC_STORAGE_LOCAL === 'true'
  : import.meta.env.DEV;

// Muy útil para arreglar nombres de archivos con tildes, espacios, mayúsculas, etc. que pueden dar problemas al subirlos a la web
function cleanFileName(filename: string): string {
  // Separamos el nombre de la extensión
  const parts = filename.split('.');
  const ext = parts.pop();
  const name = parts.join('.');

  // Aplicamos un slugify básico usando regex nativo de JS
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')                     // Descompone caracteres con tildes
    .replace(/[\u0300-\u036f]/g, '')      // Elimina los acentos
    .replace(/[^a-z0-9\s-]/g, '')         // Elimina caracteres raros
    .trim()
    .replace(/\s+/g, '-')                 // Cambia espacios por guiones
    .replace(/-+/g, '-');                 // Evita guiones dobles

  // Devolvemos el nombre limpio con su extensión original
  return `${cleanName}.${ext}`;
}

// Create a collection for each locale dynamically, using the same post schema definition
// FACTORY FUNCTION: We wrap the collection creation in a function to preserve strict TypeScript inference for the schema fields
const createPostCollection = (locale: Locale) => {
  return collection({
    label: `Posts (${locale.toUpperCase()})`,
    slugField: 'title',
    path: `src/content/${locale}/posts/*`,
    format: { contentField: 'content' },
    schema: {
      title: fields.slug({ name: { label: 'Title' } }),
      pubDate: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
      description: fields.text({ label: 'Description' }),
      author: fields.text({ label: 'Author' }),
      aiGenerated: fields.checkbox({
        label: '🤖 AI Generated Translation',
        description: 'Check this if the content was translated automatically. Uncheck it after manual review.',
        defaultValue: false,
      }),
      content: fields.markdoc({
        label: 'Content',
        options: {
          image: {
            directory: 'src/assets/images/posts',
            // IMPORTANT: "@admin-assets" is an alias defined in tsconfig.json, that should be defined in BOTH the ADMIN and WEB projects, and BOTH should point to the /admin/src/assets folder. This way, when we upload an image from the admin, it will be stored in the admin's assets folder, but we can access it from the web using the @admin-assets alias.
            publicPath: '@admin-assets/images/posts/',
            // Muy útil para arreglar nombres de archivos con tildes, espacios, mayúsculas, etc. que pueden dar problemas al subirlos a la web
            transformFilename: cleanFileName,
          },
        },
        // Register custom components in Markdoc options
        components: {
          flag: flagComponent, 
          notranslate: noTranslateComponent,
          slideshow: slideshowComponent,
          slide: slideComponent,
        }
      }),
    } satisfies KeystaticPostSchema, // 2. LE DECIMOS A TS QUE ESTE OBJETO DEBE CUMPLIR EL TIPO MAPEADO. SI VES "satisfies" EN ROJO, ES QUE FALTA ALGÚN CAMPO DE TU POST, REVISA EN EL PROYECTO core/src/schemas/posts.ts Y ASEGÚRATE DE QUE TODOS LOS CAMPOS ESTÉN AQUÍ
  });
};

const createCourseCollection = (locale: Locale) => {
  return collection({
    label: `Courses (${locale.toUpperCase()})`,
    slugField: 'title',
    path: `src/content/${locale}/courses/*`,
    format: { contentField: 'content' },
    schema: {
      unit: fields.text({
        label: 'Unit',
        validation: {
          pattern: {
            regex: courseUnitRegex,
            message: courseUnitValidationMessage,
          }
        }
      }),
      title: fields.slug({ name: { label: 'Title' } }),
      description: fields.text({ label: 'Description' }),
      content: fields.markdoc({
        label: 'Content',
        options: {
          image: {
            directory: 'src/assets/images/courses',
            publicPath: '@admin-assets/images/courses/',
            transformFilename: cleanFileName,
          },
        },
        components: {
          flag: flagComponent, 
          notranslate: noTranslateComponent,
          slideshow: slideshowComponent,
          slide: slideComponent,
        }
      }),
    } satisfies KeystaticCourseSchema,
  });
};

// 2. DYNAMIC GENERATION
// Generate the collections object by mapping over the available locales
const postCollections = locales.reduce((acc, locale) => {
  acc[`posts_${locale}`] = createPostCollection(locale);
  return acc;
}, {} as Record<`posts_${Locale}`, ReturnType<typeof createPostCollection>>);

const courseCollections = locales.reduce((acc, locale) => {
  acc[`courses_${locale}`] = createCourseCollection(locale);
  return acc;
}, {} as Record<`courses_${Locale}`, ReturnType<typeof createCourseCollection>>);

export default config({
  storage: isLocal ? {
    kind: 'local'
  } : {
    kind: 'cloud',
    pathPrefix: 'packages/admin'
  },
  // This block is only required (and evaluated) if kind is 'cloud'
  ...(!isLocal && {
    cloud: {
      project: 'ai-assistants-4-pid/ai4pid-web',  
    } satisfies Config['cloud']
  }),
  collections: {
    ...postCollections,
    ...courseCollections,
  },
});
