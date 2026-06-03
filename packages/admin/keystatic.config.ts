import { config, fields, collection } from '@keystatic/core';

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
        content: fields.markdoc({
          label: 'Content',
          options: {
            image: {
              directory: 'src/assets/images/posts',
              publicPath: '@assets/images/posts/',
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
      },
    }),
  },
});
