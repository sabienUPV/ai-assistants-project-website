import { config, fields, collection, type Config, type ComponentSchema } from '@keystatic/core';
import { block, inline, repeating, wrapper } from '@keystatic/core/content-components';
import type { Post } from '@schemas/posts';
import { type Course, courseUnitRegex, courseUnitValidationMessage } from '@schemas/courses';
import { markdocTagAttributes } from '@markdoc-tags';
import React from 'react';
import { locales, type Locale } from '@languages';
import { slideAlignValues, type SlideSchema } from '@schemas/slide';
import type { ImageSchema } from '@schemas/image';
import { calculateImageDimensionsForCrop } from '@core-utils/image';

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

const getImageSchemaOptions = (collectionName: string) => ({
  directory: `src/assets/images/${collectionName}`, // Default directory for images in the admin
  // IMPORTANT: "@admin-assets" is an alias defined in tsconfig.json, that should be defined in BOTH the ADMIN and WEB projects, and BOTH should point to the /admin/src/assets folder. This way, when we upload an image from the admin, it will be stored in the admin's assets folder, but we can access it from the web using the @admin-assets alias.
  publicPath: `@admin-assets/images/${collectionName}/`, // Public path for the web project
  transformFilename: cleanFileName, // Clean filenames to avoid issues with special characters
});

// Define custom components for Keystatic using shared core attributes
const createComponents = (collectionName: string) => ({
  flag: inline({
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
  }),
  notranslate: wrapper({
    label: 'No Translate',
    description: markdocTagAttributes.notranslate.description,
    schema: {}, // Empty, because the content is its own content
    ContentView: (props) => {
      return React.createElement('div', {}, props.children);
    }
  }),
  slideshow: repeating({
    label: 'Slideshow',
    description: markdocTagAttributes.slideshow.description,
    children: ['slide'], // Only allow slide components. This should match the tag name for slides
    schema: {}, // No additional fields for the slideshow itself, just the slides
  }),
  slide: wrapper({
    label: 'Slide',
    description: markdocTagAttributes.slide.description,
    schema: {
      title: fields.text({ label: 'Title' }),
      align: fields.select({
        label: 'Alignment',
        options: slideAlignValues.map(value => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value })),
        defaultValue: 'center' satisfies SlideSchema['align'],
      }),
    } satisfies Record<keyof SlideSchema, ComponentSchema>, // Ensure all Slide fields are present
    ContentView: (props) => {
      const { title, align } = props.value || {};
      
      return React.createElement(
        'div',
        { style: { border: '2px solid #e0e0e0', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#fff', overflow: 'hidden' } },
        // 1. La cabecera con el título (Visible sin tener que editar)
        React.createElement(
          'div', 
          {
            contentEditable: false, // Evita que el usuario edite el título directamente en la cabecera
            style: {
              userSelect: 'none', // Evita que el usuario seleccione el texto por error
              backgroundColor: '#f0f9ff',
              padding: '12px 12px',
              borderBottom: '1px solid #e0e0e0',
              fontWeight: 'bold',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1.1, // Adjusted line height manually so that the title and the align metadata align vertically as centered as possible
            } 
          }, 
          // Primer hijo: El título
          React.createElement('span', {}, title || '[Untitled]'),
          // Segundo hijo: El align (solo se renderiza si existe)
          align && React.createElement(
            'span',
            {
              style: {
                fontWeight: 'normal', // Anula el bold del padre
                fontStyle: 'italic',  // Cursiva
                fontSize: '0.8em',    // Más pequeño
                color: '#64748b'    // Opcional: un tono un poco más neutro/gris para que parezca un metadato
              }
            },
            `(align: ${align})`
          )
        ),
        // 2. El contenido
        React.createElement('div', { style: { padding: '12px' } }, props.children)
      );
    }
  }),
  columns: repeating({
    label: 'Columns',
    description: markdocTagAttributes.columns.description,
    children: ['column'], 
    schema: {},
    // Show the Column components in actual columns (side by side) in the editor canvas, instead of stacked vertically
    ContentView: (props) => {
      return React.createElement(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '16px 0' } },
        props.children
      );
    }
  }),
  column: wrapper({
    label: 'Column',
    description: markdocTagAttributes.column.description,
    schema: {},
  }),
  // Note: We cannot call it "image" because Keystatic already has a built-in "image" component, so we call it "customImage" just for Markdoc and Keystatic
  // (but in the UI and Astro component we still call it "Image" for clarity)
  customImage: block({
    label: 'Image',
    description: markdocTagAttributes.customImage.description,
    schema: {
      image: fields.image({
        label: 'Source Image',
        validation: { isRequired: true },
        ...getImageSchemaOptions(collectionName)
      }),
      alt: fields.text({ label: 'Alternative Text', validation: { isRequired: true } }),
      title: fields.text({ label: 'Title' }),
      width: fields.number({ label: 'Width (px)' }),
      height: fields.number({ label: 'Height (px)' }),
      cropTop: fields.integer({
        label: 'Top Crop (%)',
        // The field is optional (returns null if empty), but strictly validates 0-100 if a value is provided
        validation: { min: 0, max: 100 },
      }),
      cropRight: fields.integer({
        label: 'Right Crop (%)',
        validation: { min: 0, max: 100 },
      }),
      cropBottom: fields.integer({
        label: 'Bottom Crop (%)',
        validation: { min: 0, max: 100 },
      }),
      cropLeft: fields.integer({
        label: 'Left Crop (%)',
        validation: { min: 0, max: 100 },
      }),
    } satisfies Record<keyof ImageSchema, ComponentSchema>,
    ContentView: (props) => {
      const { image, alt, title, width, height, cropTop, cropRight, cropBottom, cropLeft } = props.value || {};

      // Determinamos qué src usar de forma segura
      let imageSrc;
      if (image) {
        if (typeof image === 'string') {
          // 1. La imagen ya estaba guardada, es una ruta normal
          imageSrc = image;
        } else if (image.data) {
          // 2. La imagen está recién subida al editor, creamos el Blob dinámico
          imageSrc = URL.createObjectURL(
            new Blob([new Uint8Array(image.data)], { type: 'image/' + image.extension })
          );
        }
      }

      const { aspectRatio : aspectRatioFromCrop, scaleX, scaleY, shiftX, shiftY } = calculateImageDimensionsForCrop(
        width || 800, // Default width if not provided
        height || 600, // Default height if not provided
        cropTop ?? 0,
        cropRight ?? 0,   
        cropBottom ?? 0,
        cropLeft ?? 0
      );
      
      // Creamos el contenedor (Wrapper)
      return React.createElement(
        'div',
        {
          style: {
            position: 'relative',
            overflow: 'hidden', // Las tijeras mágicas
            // For the aspect ratio, if the user has provided both a width and height,
            // we don't want to use the calculated aspect ratio from the crop, because that would distort the image,
            // we want to use the user-provided width and height to determine the aspect ratio.
            // If the user has not provided both a width and height, we fall back to the calculated aspect ratio from the crop.
            aspectRatio: width && height ? (width / height) : aspectRatioFromCrop,
            width: width ? `${width}px` : '100%',
            maxWidth: '100%',
            border: '1px solid #e0e0e0', // El borde ahora se queda a salvo
            borderRadius: '4px',
            display: imageSrc ? 'block' : 'none',
            margin: '1rem auto'
          }
        },
        // Creamos la imagen por dentro
        React.createElement('img', {
          src: imageSrc,
          alt: alt || '',
          title: title || '',
          style: {
            position: 'absolute',
            maxWidth: 'none', // Vital para que crezca más del 100%
            objectFit: 'fill',
            
            // Aplicamos el tamaño gigante y el desplazamiento
            width: `${scaleX}%`,
            height: `${scaleY}%`,
            left: `-${shiftX}%`,
            top: `-${shiftY}%`
          }
        })
      );
    }
  }),
  quiz: repeating({
    label: 'Quiz',
    description: markdocTagAttributes.quiz.description,
    children: ['question'],
    schema: {},
  }),
  question: block({
    label: 'Question',
    description: markdocTagAttributes.question.description,
    schema: {
      prompt: fields.text({ label: 'Prompt', validation: { isRequired: true }, multiline: true }),
      answers: fields.array(
        fields.object({
          text: fields.text({ label: 'Answer Text', validation: { isRequired: true } }),
          isCorrect: fields.checkbox({ label: 'Is Correct', defaultValue: false }),
          explanation: fields.text({ label: 'Explanation' }),
        }),
        {
          label: 'Answers',
          itemLabel: (props) => props.fields.text.value ?? 'New Answer',
          validation: { length: { min: 1 } },
        }
      ),
    },
    ContentView: (props) => {
      const { prompt, answers } = props.value || {};

      return React.createElement(
        'div',
        { style: { border: '2px solid #e0e0e0', borderRadius: '8px', padding: '12px', marginBottom: '16px', backgroundColor: '#f9fafb' } },
        React.createElement('strong', {}, 'Question: '),
        React.createElement('span', {}, prompt || 'New Question'),
        React.createElement('ul', { style: { marginTop: '8px' } },
          (answers || []).map((answer, index) => 
            React.createElement('li', { key: index, style: { color: answer.isCorrect ? '#16a34a' : '#000' } },
              answer.text || 'New Answer',
              answer.isCorrect ? ' ✅' : '',
              answer.explanation ? ` (Explanation: ${answer.explanation})` : ''
            )
          ) 
        )
      );
    }
  }),
  arasaac: block({
    label: 'ARASAAC Pictogram',
    description: markdocTagAttributes.arasaac.description,
    schema: {
      id: fields.text(
        {
          label: 'ID',
          validation: { isRequired: true },
          description: markdocTagAttributes.arasaac.attributes.id.description,
        }),
      alt: fields.text({ label: 'Alternative Text', validation: { isRequired: true } }),
      size: fields.number({ label: 'Size (px)', validation: { min: 1, max: 2500 } }),
    },
    ContentView: (props) => {
      const { id, alt, size } = props.value || {};

      return React.createElement(
        'div',
        { style: { textAlign: 'center', margin: '1rem 0' } },
        React.createElement('img', {
          // ARASAAC API endpoint to fetch pictograms: https://api.arasaac.org/api/pictograms/:id
          // (see API documentation here: https://arasaac.org/developers/api)
          // (Note: The resolution is 500px by default, but we can request a higher resolution (2500px) by adding the query parameter `?resolution=2500` to the URL. However, we should only do this for sizes greater than 500px to avoid unnecessary bandwidth usage.)
          src: `https://api.arasaac.org/api/pictograms/${id}${size && size > 500 ? '?resolution=2500' : ''}`,
          alt: alt || '',
          style: {
            width: size ? `${size}px` : '150px',
            height: 'auto',
            objectFit: 'contain',
          }
        })
      );
    }
  })
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
          image: getImageSchemaOptions('posts'),
        },
        // Register custom components in Markdoc options
        components: createComponents('posts'),
      }),
    } satisfies KeystaticPostSchema, // 2. LE DECIMOS A TS QUE ESTE OBJETO DEBE CUMPLIR EL TIPO MAPEADO. SI VES "satisfies" EN ROJO, ES QUE FALTA ALGÚN CAMPO DE TU POST, REVISA EN EL PROYECTO core/src/schemas/posts.ts Y ASEGÚRATE DE QUE TODOS LOS CAMPOS ESTÉN AQUÍ
  });
};

const createCourseCollection = (locale: Locale) => {
  return collection({
    label: `Courses (${locale.toUpperCase()})`,
    slugField: 'unit',
    parseSlugForSort: (slug) => {
      // Change the slug back to the unit replacing dashes with dots (e.g. "1-2" becomes "1.2") to get the unit number
      const unit = slug.replace(/-/g, '.');
      // Return the unit number as a number with decimals for sorting purposes
      // (e.g. "1.2" will be sorted after "1" and before "2")
      return parseFloat(unit);
    },
    path: `src/content/${locale}/courses/*`,
    format: { contentField: 'content' },
    schema: {
      unit: fields.slug({
        name: {
          label: 'Unit',
          validation: {
            pattern: {
              regex: courseUnitRegex,
              message: courseUnitValidationMessage,
            }
          }
        },
        slug: {
          generate: (unit) => unit.replace(/\./g, '-'), // Replace dots with dashes for the slug (e.g. "1.2" becomes "1-2")
        }  
      }),
      title: fields.text({ label: 'Title' }),
      description: fields.text({ label: 'Description' }),
      content: fields.markdoc({
        label: 'Content',
        options: {
          image: getImageSchemaOptions('courses'),
        },
        components: createComponents('courses'),
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
