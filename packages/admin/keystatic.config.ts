import { config, fields, collection, type Config } from '@keystatic/core';
import { inline, wrapper } from '@keystatic/core/content-components';
import type { Post } from '@sabien-upv-astro-cms/core';
import { markdocTagAttributes } from '@sabien-upv-astro-cms/core';
import React from 'react';
import { locales, type Locale } from '@languages';

// 1. CREAMOS EL TIPO MAPEADO
// Le exigimos a TS que este objeto tenga obligatoriamente todas las keys de tu Post de Zod.
// Usamos `any` como valor porque no nos importa el tipo interno de Keystatic (fields.text, etc.),
// solo nos importa que la KEY (title, author, pubDate) exista.
type KeystaticPostSchema = {
  [K in keyof Post]: any; 
} & {
  content: any; // Añadimos 'content' porque Keystatic lo necesita para el Markdoc
};

// Define custom inline components for Keystatic using shared core attributes
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
  schema: {}, // Vacío, porque el contenido son sus propios hijos nativos
  ContentView: (props) => {
    return React.createElement('div', {}, props.children);
  }
});

// Select storage kind based on environment variable:
// - In local development, we default to 'local' storage for simplicity.
// - In production, we default to 'cloud' storage (Keystatic Cloud) to deploy directly to the production environment (the GitHub repository).
// If we manually set the environment variable KEYSTATIC_STORAGE_LOCAL to 'true' or 'false', it will override the defaults.
const isLocal = import.meta.env.KEYSTATIC_STORAGE_LOCAL 
  ? import.meta.env.KEYSTATIC_STORAGE_LOCAL === 'true'
  : import.meta.env.DEV;

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
            transformFilename: (filename) => {
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
          },
        },
        // Register custom components in Markdoc options
        components: {
          flag: flagComponent, 
          notranslate: noTranslateComponent,
        }
      }),
    } satisfies KeystaticPostSchema, // 2. LE DECIMOS A TS QUE ESTE OBJETO DEBE CUMPLIR EL TIPO MAPEADO. SI VES "satisfies" EN ROJO, ES QUE FALTA ALGÚN CAMPO DE TU POST, REVISA EN EL PROYECTO core/src/schemas/posts.ts Y ASEGÚRATE DE QUE TODOS LOS CAMPOS ESTÉN AQUÍ
  });
};

// 2. DYNAMIC GENERATION
// Generate the collections object by mapping over the available locales
const postCollections = locales.reduce((acc, locale) => {
  acc[`posts_${locale}`] = createPostCollection(locale);
  return acc;
}, {} as Record<`posts_${Locale}`, ReturnType<typeof createPostCollection>>);

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
  },
});
