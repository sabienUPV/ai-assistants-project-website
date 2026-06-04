import { config, fields, collection } from '@keystatic/core';
import type { Post } from '@sabien-upv-astro-cms/core';

// 1. CREAMOS EL TIPO MAPEADO
// Le exigimos a TS que este objeto tenga obligatoriamente todas las keys de tu Post de Zod.
// Usamos `any` como valor porque no nos importa el tipo interno de Keystatic (fields.text, etc.),
// solo nos importa que la KEY (title, author, pubDate) exista.
type KeystaticPostSchema = {
  [K in keyof Post]: any; 
} & {
  content: any; // Añadimos 'content' porque Keystatic lo necesita para el Markdoc
};

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        pubDate: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
        description: fields.text({ label: 'Description' }),
        author: fields.text({ label: 'Author' }),
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
        }),
      } satisfies KeystaticPostSchema, // 2. LE DECIMOS A TS QUE ESTE OBJETO DEBE CUMPLIR EL TIPO MAPEADO. SI VES "satisfies" EN ROJO, ES QUE FALTA ALGÚN CAMPO DE TU POST, REVISA EN EL PROYECTO core/src/schemas/posts.ts Y ASEGÚRATE DE QUE TODOS LOS CAMPOS ESTÉN AQUÍ
    }),
  },
});
