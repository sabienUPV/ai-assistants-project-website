import type { ImageMetadata } from 'astro';

const adminImages = import.meta.glob<{ default: ImageMetadata }>(
  '/../admin/src/assets/images/**/*.{jpeg,jpg,png,gif,webp}'
);

export async function resolveAdminImage(imagePath?: string): Promise<ImageMetadata | undefined> {
  if (!imagePath) return undefined;

  const assetPath = imagePath.substring(imagePath.lastIndexOf('assets') + 1);
  const matchedPath = Object.keys(adminImages).find((path) => path.endsWith(assetPath));
  if (!matchedPath) {
    console.warn(`Image not found for path: ${imagePath}`);
    return undefined;
  }

  return (await adminImages[matchedPath]()).default;
}

export async function resolveAdminImageSrc(imagePath?: string): Promise<string | undefined> {
  return (await resolveAdminImage(imagePath))?.src;
}
