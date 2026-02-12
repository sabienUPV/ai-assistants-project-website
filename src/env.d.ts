/// <reference path="../.astro/types.d.ts" />

// 1. imports make this file a module
import type { TranslationHelper } from './utils/translation';
import type { Lang } from './languages';

// 2. WRAP YOUR NAMESPACE IN 'declare global'
declare global {
  namespace App {
    interface Locals {
      t: TranslationHelper;
      lang: Lang;
    }
  }
}

// 3. Keep this export if you have other code,
//    but strictly speaking for a .d.ts it's implied by the import.
export {};