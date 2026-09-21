/**
 * Regular expression to validate that a slug is not a reserved keyword.
 * If the slug is named "search" or "list", it would conflict with the reserved keywords used in the URL structure of the website. Therefore, we need to prevent users from using these reserved keywords as slugs for their posts. This regex pattern ensures that the slug does not match "search" or "list", while allowing any other valid slug.
 */
export const slugReservedKeywordsRegex = /^(?!search$|list$).+$/;
export const slugReservedKeywordsMessage = 'Slug cannot be a reserved keyword like "search" or "list".';

// Unit format: "1.2.3.4" (allows infinite number of subdivisions, but each level must be a positive integer)
export const courseUnitRegex = /^\d+(\.\d+)*$/;
export const courseUnitValidationMessage = 'Unit must be in the format "1.2.3.4". It can have any number of subdivisions';