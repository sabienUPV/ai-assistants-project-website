/**
 * Proper way to reference the homepage or subpaths
 * handles base paths for GitHub Pages deployments
 * (since default is '/' but GitHub Pages often uses '/repo-name'
 * without the trailing slash, so we account for both cases)
 */
export const home = (path: string = ''): string => {
  // 1. Remove trailing slash from BASE_URL if it exists
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // 2. Ensure the path starts with a slash
  const validPath = path.startsWith('/') ? path : `/${path}`;

  // 3. Combine them
  return `${base}${validPath}`;
};