export function supportsCssAnchorPositioning(document: Document) {
  return "anchorName" in document.documentElement.style;
}