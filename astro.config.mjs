// @ts-check
import { defineConfig } from 'astro/config';
import { defaultLocale, locales } from './src/languages';

// https://astro.build/config
export default defineConfig({
  i18n: {
    // Define these languages in src/languages.ts
    // (we do this to have a single source of truth for our languages, which we can also use in our codebase)
    defaultLocale: defaultLocale,
    locales: [...locales],
    routing: {
      prefixDefaultLocale: true
    }
  }
});
