/**
 * Calculates the new aspect ratio, scale, and shift values for an image that has been cropped.
 * @param originalWidth - The original width of the image.
 * @param originalHeight - The original height of the image.
 * @param cropTop - The percentage of the image cropped from the top.
 * @param cropRight - The percentage of the image cropped from the right.
 * @param cropBottom - The percentage of the image cropped from the bottom.
 * @param cropLeft - The percentage of the image cropped from the left.
 * @returns An object containing the new aspect ratio, scale, and shift values.
 */
export function calculateImageDimensionsForCrop(originalWidth: number, originalHeight: number, cropTop: number, cropRight: number, cropBottom: number, cropLeft: number): { aspectRatio: number; scaleX: number; scaleY: number; shiftX: number; shiftY: number } {
  // 1. Calculate the visible percentage of the cropped container
  const visibleWidthPct = 100 - cropLeft - cropRight;
  const visibleHeightPct = 100 - cropTop - cropBottom;
  return {
    // 2. Calculate the new exact aspect ratio of the cropped container
    aspectRatio: (originalWidth * (visibleWidthPct / 100)) / (originalHeight * (visibleHeightPct / 100)),
    // 3. Calculate how much to scale the image within the container so that it fits
    scaleX: (100 / visibleWidthPct) * 100, 
    scaleY: (100 / visibleHeightPct) * 100,
    // 4. Calculate the negative offset/shift (Top/Left)
    shiftX: (cropLeft / visibleWidthPct) * 100,
    shiftY: (cropTop / visibleHeightPct) * 100
  };
}