export async function loadPopoverPolyfill() {
  if (!isPopoverSupported()) {
    // DYNAMIC IMPORT: Vite will split this into a separate chunk! Only downloaded if the browser fails the check
    const { apply } = await import('@oddbird/popover-polyfill/fn');
    apply();
  }
}

export async function loadCssAnchorPositioningPolyfill(document: Document) {
  if (!isCssAnchorPositioningSupported(document)) {
    // DYNAMIC IMPORT: Only downloaded if the browser fails the check
    const { default: polyfill } = await import("@oddbird/css-anchor-positioning/fn");
    await polyfill();
    // Add CSS class to the documentElement to indicate that the polyfill is active, so we can use it in our CSS to apply specific styles for the polyfill if needed
    document.documentElement.classList.add("css-anchor-positioning-polyfill");
  }
}

/**
 * Source: https://github.com/oddbird/popover-polyfill/blob/9d94b253b05a25496c18de683bc74b9069706a11/src/popover.ts#L19
 */
export function isPopoverSupported() {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype === 'object' &&
    'popover' in HTMLElement.prototype
  );
}

export function isCssAnchorPositioningSupported(document: Document) {
  return "anchorName" in document.documentElement.style;
}
