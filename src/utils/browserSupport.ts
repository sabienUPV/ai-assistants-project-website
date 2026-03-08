export function supportsCssAnchorPositioning() : boolean {
  return window.CSS && CSS.supports && CSS.supports('top', 'anchor(bottom)');
}

export const needsDropdownPolyfill : () => boolean = () => !supportsCssAnchorPositioning();
/**
 * Dynamically loads the dropdown polyfill for browsers that don't support CSS anchor positioning. This includes both the necessary CSS and JS to ensure the dropdowns work correctly, while avoiding loading unnecessary code for modern browsers that do support the feature.
 */
export async function loadDropdownPolyfill(mediaQuery?: MediaQueryList) {
  // 1. Get the URL of the CSS file using the ?url suffix
  const cssUrl = (await import('@styles/polyfills/polyfill-dropdown.css?url')).default;

  // 2. Inject the link tag manually
  if (!document.getElementById('dropdown-polyfill-css')) {
    const link = document.createElement('link');
    link.id = 'dropdown-polyfill-css';
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  // 3. Load the JS
  const { dropdownPolyfill } = await import('@scripts/polyfills.ts');
  dropdownPolyfill(mediaQuery);
}