/**
 * Polyfill for dropdowns that don't support CSS anchor positioning.
 * Instead of relying on the popover API, we use JavaScript to toggle the visibility of the dropdown menu and manage ARIA attributes for accessibility.
 */
export function dropdownPolyfill(mediaQuery?: MediaQueryList) {
  // Setup dropdowns on the page
  document.querySelectorAll('.dropdown-wrapper').forEach(wrapper => {
    const trigger = wrapper.querySelector<HTMLButtonElement>('.dropdown-trigger');
    const menu = wrapper.querySelector<HTMLDivElement>('.dropdown-menu');

    if (!trigger || !menu) return;

    // Check if the open icon is present for animation purposes in the fallback.
    const openIcon = trigger.querySelector('.dropdown-icon-open');
    if (openIcon) {
      wrapper.classList.add('animate-icon');
    }

    // Just in case we have a browser that doesn't support anchor positioning but does support the popover API, we remove the popover related attributes to prevent any weird behavior.
    trigger.removeAttribute('popovertarget');
    menu.removeAttribute('popover');

    // The popovertarget attribute is ignored, so we polyfill the behavior.
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    // Add click event listener to toggle the dropdown menu.
    trigger.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent any default button action
      const isOpen = wrapper.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the dropdown if the user clicks outside of it.
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target as Node) && wrapper.classList.contains('is-open')) {
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Also handle resize for mobile-only dropdowns in the fallback.
    mediaQuery?.addEventListener('change', (e) => {
      if (e.matches && wrapper.classList.contains('mobile-only')) {
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
}