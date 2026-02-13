import { defineMiddleware } from "astro:middleware";
import { getFormatter } from "@utils/translation";
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

  // Create the formatter ONCE per page
  const t = getFormatter(locale);

  // Create the home function with language support for this page
  const homeLocale : HomeHelper = getHomeHelperFn(locale);

  // "Cascade" it to every component
  context.locals.t = t;
  context.locals.homeLocale = homeLocale;

  return next();
});