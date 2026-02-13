import { defineMiddleware } from "astro:middleware";
import { getFormatter } from "@utils/translation"; // Your optimized formatter
import { supportedLangs, type Lang } from "@languages";
import { getHomeFnWithLang } from "@utils/url";

// NOTE: Even though we are using Static Site Generation (SSG), Astro's middleware runs at build time for each page.
// So we can safely use it to set up our translations without worrying about runtime performance.
// The key is that we create the formatter once per page and then cascade it down through context.locals, which we can then access via Astro.locals in any component or page.
export const onRequest = defineMiddleware((context, next) => {
  // 1. Get the language parameter
  // Your page should be inside the pages/[lang]/ directory,
  // and it should also be defined in getStaticPaths
  // (you can use the getStaticPathsFromLangs helper for that)
  const langParam = context.params.lang;

  // 2. Validate it. If it's not a known lang, default to 'en' (or handle 404)
  const lang: Lang = langParam && supportedLangs.includes(langParam as Lang)
    ? (langParam as Lang)
    : 'en';

  // 3. Create the optimized formatter ONCE per page
  const t = getFormatter(lang);

  // 3.5 Create the home function with language support for this page
  const homeLang = getHomeFnWithLang(lang);

  // 4. "Cascade" it to every component
  context.locals.t = t;
  context.locals.homeLang = homeLang;
  context.locals.lang = lang;

  return next();
});