// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { defaultLocale, locales } from './src/languages';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  fonts: [
    {
      name: 'Roboto',
      cssVariable: '--font-roboto',
      provider: fontProviders.fontsource(),
      weights: [400, 700], // Regular and Bold weights
      styles: ['normal'], // Only normal style, no italics for better accessibility
      subsets: ['latin', 'latin-ext'] // Only the Latin subset and latin-ext for Croatian characters, which is sufficient for our languages and helps reduce font file size
    },
  ],

  i18n: {
    // Define these languages in src/languages.ts
    // (we do this to have a single source of truth for our languages, which we can also use in our codebase)
    defaultLocale: defaultLocale,
    locales: [...locales],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false // We handle redirection from the root URL '/' ourselves, so that we redirect to the client's preferred language instead of always redirecting to the default language
    }
  },

  integrations: [icon({
    // We use the "astro-icon" integration to easily use icons from various icon libraries in our components
    iconDir: 'src/assets/icons',
  })]
});