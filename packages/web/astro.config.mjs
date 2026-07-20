// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { defaultLocale, locales } from '../core/src/languages';

import icon from 'astro-icon';

import markdoc from '@astrojs/markdoc';
import svelte from '@astrojs/svelte';

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

  image: {
    remotePatterns: [
      // We allow loading images from the ARASAAC API, which provides pictograms for our courses
      {
        protocol: 'https',
        hostname: 'api.arasaac.org',
        port: '',
        pathname: '/api/pictograms/**',
      },
      // We allow loading images from YouTube, which provides thumbnails for our YouTube videos
      {
        protocol: 'https',
        hostname: 'i.ytimg.com', 
      },
    ],
  },

  integrations: [icon({
    // We use the "astro-icon" integration to easily use icons from various icon libraries in our components
    iconDir: 'src/assets/icons',
  }), markdoc(), svelte()],
});