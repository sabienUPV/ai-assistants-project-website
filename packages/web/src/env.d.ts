/// <reference path="../.astro/types.d.ts" />

// 1. imports make this file a module
import type { TranslationHelper } from '@utils/translation';
import type { GlossaryHelper } from '@utils/glossary';
import type { HomeHelper } from '@utils/localizedUrl';
import type { Locale } from '@languages';

// 2. WRAP YOUR NAMESPACE IN 'declare global'
declare global {
  namespace App {
    interface Locals {
      locale: Locale; // Add the locale to the context
      t: TranslationHelper; // Add the translation helper for the current locale to the context
      homeLocale: HomeHelper; // Add the home function with language support to the context
      getGlossaryHtmlForTerm: GlossaryHelper; // Add the glossary helper to the context
    }
  }
}

// 3. Keep this export if you have other code,
//    but strictly speaking for a .d.ts it's implied by the import.
export {};