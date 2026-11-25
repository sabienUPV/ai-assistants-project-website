# Agent Guide

## Project Overview and Monorepo Structure

This repository is an Astro-based, multilingual website and content-management system for the AI-ASSISTANTS 4PID project. Its architecture is designed to remain domain-agnostic so the monorepo can be reused as a template for similar future projects. Keep shared functionality reusable and avoid duplicating schemas, language definitions, or Markdoc contracts across workspaces. Keep project-specific content and configuration separate from reusable implementation.

- `packages/core` is the shared TypeScript package. It owns supported locales, constants, content schemas, Markdoc tag definitions, core types, and the local-LLM translation CLI.
- `packages/web` is the public, statically generated Astro website. It consumes shared core definitions and reads editorial `.mdoc` content and images from `packages/admin`.
- `packages/admin` is the Astro/Keystatic CMS. It edits localized posts and courses and stores their Markdoc files and images in its own `src/content` and `src/assets` directories.
- `packages/web` and `packages/admin` both depend on the `@sabien-upv-astro-cms/core` npm workspace. Make shared schema or tag changes in `core`, then update any dependent CMS editor and web renderer.
- `python` contains a PowerPoint-to-Markdoc course content helper. `ollama` contains local LLM setup helpers. Root Dockerfiles and `compose.yaml` build and run the web and admin workspaces.

## Commands and Verification

Use Node.js 24 and npm, matching the GitHub Actions workflow. Run `npm ci` from the repository root to install and link all workspaces.

| Task | Command (from repository root) |
| --- | --- |
| Typecheck Astro projects | `npm run check` |
| Start the public website | `npm run web:dev` |
| Start the CMS | `npm run admin:dev` |
| Build the public website | `npm run web:build` |
| Build the CMS | `npm run admin:build` |
| Run core translation tests | `npm run -w @sabien-upv-astro-cms/core test` |

Use `npm run check` for routine verification: it runs each workspace's `check` script when present, which means `astro check` in `web` and `admin`. `core` has no check script. Prefer this fast check over full builds for routine code changes; build the affected workspace when a change depends on build-time behavior.

The root package also provides `npm run translate:posts` and `npm run translate:ai-solutions`. These use the core LLM CLI and local Ollama configuration; review generated translations before treating them as final.

## Architecture and Coding Conventions

### Workspace imports and path aliases

Aliases are declared per workspace in its `tsconfig.json`; preserve those mappings when moving code.

- `core`: `@languages`, `@constants`, `@schemas/*`, `@markdoc-tags`, `@core-utils/*`, and `@core-types/*`.
- `web`: `@assets/*`, `@components/*`, `@layouts/*`, `@pages/*`, `@scripts/*`, `@styles/*`, `@utils/*`, plus shared core aliases. Its `@admin-assets/*` points to `packages/admin/src/assets/*`.
- `admin`: `@admin-assets/*` points to its own `src/assets/*`, and it also defines `@styles/*` and the shared core aliases.

Use aliases instead of brittle relative paths where the project already uses them. `@admin-assets` is deliberately shared by the CMS and web: Keystatic writes images under `packages/admin/src/assets/images/{posts,courses}`, while web content references those files through the same public alias.

### Astro routing, content, and internationalization

- `packages/core/src/languages.ts` is the single source of truth for locale codes and the default locale. Update it when adding a language, then keep content, translations, and CMS collections in sync.
- Public routes are under `packages/web/src/pages/[locale]/`; the root page detects the browser language and redirects to a localized homepage. Static locale routes use `getStaticPathsFromLocales()` or an equivalent locale-aware `getStaticPaths()`.
- `packages/web/src/middleware.ts` sets `Astro.locals.locale`, `Astro.locals.t`, `Astro.locals.homeLocale`, and glossary helpers for pages and components. Use `Astro.locals.t()` for translated UI text rather than hardcoding interface labels.
- Add interface strings to `packages/web/src/content/translations.csv` with a stable `id` and a value for every supported locale. Add glossary entries to `glossary.csv` with each locale's term and definition. AI-solution data is in one locale-specific CSV per language under `src/content/ai-solutions/`.
- Posts and courses are stored in `packages/admin/src/content/<locale>/posts` and `courses`. The web creates a localized collection for each locale and falls back to English content when an entry is missing in the requested language. Keep corresponding entry slugs consistent across locales so fallback lookups and localized routes work.
- `hasMarkdownFiles()` in `packages/web/src/content.config.ts` deliberately returns empty collections for missing or empty locale directories. Preserve this guard: several supported locales currently have no course files.
- The AI-solution CSV loader uses schema field order for its columns. Keep localized CSV columns aligned with the shared schema and with each other.

### Markdoc and interactive content

- Shared tag attributes and Astro render mappings live in `packages/core/src/markdoc-tags.ts`; both `packages/web/markdoc.config.mjs` and `packages/admin/markdoc.config.mjs` use `getMarkdocTags()`. When adding or changing a tag, update its shared types/schema and attributes, its Keystatic editor component in `packages/admin/keystatic.config.ts`, and its web Astro renderer as needed.
- Markdoc renderer paths are relative to the consuming workspace. Preserve the `getMarkdocTags('web' | 'admin')` distinction when changing tag wiring.
- `imageContainer` supports one image only; extra content is ignored. Keep its CMS validation and web renderer behavior aligned.
- Use Astro components for server-rendered structure and thin wrappers around Svelte client islands in `packages/web/src/components/client/`. Svelte components use Svelte 5 runes (`$props()`, `$state()`, `$derived()`, and `$effect()`) rather than legacy component state syntax.
- Resolve translated strings in the `.astro` wrapper via `Astro.locals.t()` and pass them as `localizedTexts` props to client islands. Do not import translation or other CSV data into a browser island.
- Preserve the data and event contracts between Markdoc tags, Astro wrappers, and Svelte islands. In particular, slideshow and quiz components coordinate through DOM custom events, and game wrappers supply the IDs used by the interactive games.

### Styles and accessibility

- Global styling is in `packages/web/src/styles/global.scss`; shared breakpoints are in `_variables.scss`, and Vite injects those variables into SCSS files. Use `@use` and existing CSS custom properties rather than duplicating global tokens.
- Easy Read mode is enabled by the `easy-to-read` class on the root `<html>` element. Its typography rules are in `global.scss`, with layout-specific adaptations in `Layout.astro` and interactive components. Keep screen-reader and accessibility behavior intact when changing these styles.
- Print rules are distributed across `global.scss`, layouts, pages, and components. Check both global `@media print` rules and component-specific print behavior when changing content or controls; `.no-print` and `.print-only` are shared utilities.

### Keystatic CMS and assets

- Keystatic creates a posts and courses collection for every supported locale, rooted at `packages/admin/src/content/<locale>/...`. Keep collection schema fields consistent with the Zod schemas in `packages/core/src/schemas`.
- CMS storage defaults to local in development and cloud in production. `KEYSTATIC_STORAGE_LOCAL=true|false` overrides that choice; do not change the default or cloud project configuration casually.
- Store course and post images under `packages/admin/src/assets/images/courses` and `posts`, respectively. Keep the CMS image `directory` and `publicPath` options aligned with the web `@admin-assets` alias and content references.

## Git, CI/CD, and Environment Conventions

- `.gitattributes` normalizes text files to LF and explicitly keeps `.astro`, `.svelte`, `.mdoc`, `.csv`, `.py`, YAML, and SVG files on LF. It maps `*.mdoc` to GitHub Linguist's Markdown language. Binary assets are marked as binary; preserve these rules.
- The web `astro.config.mjs` intentionally omits `site` and `base`. GitHub Actions injects both during the Pages build using the Pages origin and base path. Do not hardcode a project domain or repository path in Astro config.
- `packages/web/src/pages/robots.txt.ts` only emits a `Sitemap:` line when `Astro.site` is available. Keep local builds valid without a configured site.
- The Pages workflow builds only `packages/web`, from the root npm workspace install, and deploys its `dist` output. Changes to shared core code or admin-managed content can trigger the web deployment.
- The root Docker setup builds the web as a static Nginx site and the admin as a Node server. Preserve the root workspace installation/linking assumptions in the Dockerfiles when changing workspace dependencies.

## Known Harmless Warnings

- A local web build without `site` configured may report that `@astrojs/sitemap` is skipping sitemap generation. This is expected: production GitHub Pages builds inject `site` and `base`.
- `packages/web/astro.config.mjs` filters Rollup's false-positive `UNUSED_EXTERNAL_IMPORT` warning for `flip` from `svelte/animate` during Astro's SSR pre-render pass. `animate:flip` is still used in the client bundle; do not remove the filter or the `flip` import in `OrderGame.svelte`.
