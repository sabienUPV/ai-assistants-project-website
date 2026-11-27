import type { ImageMetadata } from 'astro';

// Astro's <Image /> component and image consumers require the imported file metadata object
// for local files rather than a raw string path from Keystatic.
// Note: Vite's import.meta.glob does NOT allow dynamic paths, so we anchor the pattern to the
// web package root ("/") and go up one level to the monorepo `packages/` folder to reach `admin`.
// Anchoring to "/" instead of using relative "../" paths ensures moving this utility file later
// will not break asset resolution.
const adminImages = import.meta.glob<{ default: ImageMetadata }>(
  '/../admin/src/assets/images/**/*.{jpeg,jpg,png,gif,webp}'
);

/**
 * Resolves a Keystatic asset path (e.g., "@admin-assets/images/courses/6-1/slide_1.png")
 * into Astro's imported `ImageMetadata` object.
 */
export async function resolveAdminImage(imagePath?: string): Promise<ImageMetadata | undefined> {
  if (!imagePath) return undefined;

  // Match the suffix from "assets/..." onward so "@admin-assets/images/..." maps cleanly
  // to the actual file path inside `packages/admin/src/assets/...`.
  const assetPath = imagePath.substring(imagePath.lastIndexOf('assets') + 1);
  const matchedPath = Object.keys(adminImages).find((path) => path.endsWith(assetPath));
  if (!matchedPath) {
    console.warn(`Image not found for path: ${imagePath}`);
    return undefined;
  }

  return (await adminImages[matchedPath]()).default;
}

/**
 * Convenience wrapper that resolves a Keystatic asset path directly to its public `.src` URL
 * (useful for client components like Svelte islands that expect a plain image URL string).
 */
export async function resolveAdminImageSrc(imagePath?: string): Promise<string | undefined> {
  return (await resolveAdminImage(imagePath))?.src;
}