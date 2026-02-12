// Define your languages here as a single source of truth
export const supportedLangs = ['en', 'es', 'de', 'pt', 'it', 'hr'] as const;
export type Lang = typeof supportedLangs[number];