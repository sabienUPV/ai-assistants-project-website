import { defineMiddleware } from "astro:middleware";
import { getTranslationHelperFn, getGlossaryHtmlForTermFn } from "@utils/translation";
import { getHomeHelperFn, type HomeHelper } from "@utils/localizedUrl"; // URL helper for locale-aware links
import { defaultLocale, type Locale } from "@languages";

// NOTE: Even though we are using Static Site Generation (SSG), Astro's middleware runs at build time for each page.
// So we can safely use it to set up our translations without worrying about runtime performance.
// The key is that we create the formatter once per page and then cascade it down through context.locals, which we can then access via Astro.locals in any component or page.
export const onRequest = defineMiddleware((context, next) => {
  // Get the locale from astro's i18n context
  // Your page should be inside the pages/[locale]/ directory,
  // and it should also be defined in getStaticPaths
  // (you can use the getStaticPathsFromLocales helper in translation.ts for that)
  const locale = (context.currentLocale || defaultLocale) as Locale;

  // "Cascade" these to every component
  context.locals.locale = locale;
  context.locals.t = getTranslationHelperFn(locale); // Create the translation helper for the current locale
  context.locals.homeLocale = getHomeHelperFn(locale); // Create the home function that takes into account the current locale
  context.locals.getGlossaryHtmlForTerm = getGlossaryHtmlForTermFn(locale); // Create the glossary helper for the current locale

  return next();
});