export function supportsCssAnchorPositioning() {
  return window.CSS && CSS.supports && CSS.supports('top', 'anchor(bottom)');
}