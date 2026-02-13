import { getRelativeLocaleUrl } from "astro:i18n";

export type HomeHelper = (path?: Parameters<typeof getRelativeLocaleUrl>[1], options?: Parameters<typeof getRelativeLocaleUrl>[2]) => ReturnType<typeof getRelativeLocaleUrl>;

export function getHomeHelperFn(locale: string): HomeHelper {
  return (path, options) => getRelativeLocaleUrl(locale, path, options);
}