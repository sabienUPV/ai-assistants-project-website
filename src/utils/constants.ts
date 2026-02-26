export const PROJECT_NAME = 'AI-ASSISTANTS 4PIDS';

/**
 * This is the same as {@link PROJECT_NAME} but with spaces for screen readers to read it correctly
 */
export const PROJECT_NAME_FOR_SCREEN_READERS = 'A I Assistants For PIDs';

export const COPYRIGHT_YEARS = '2026'; // Update with the actual year(s) of the project

export const CONTACT_EMAIL = 'test@example.com'; // TODO: Update with actual contact email

// Info for the Imprint ("Aviso Legal" in Spanish)
// TODO: Update with actual coordinator and tech provider information
export const COORDINATOR_NAME = "Nombre de la Institución Coordinadora";
export const COORDINATOR_ADDRESS = "Calle Principal 123, 28000 Ciudad, País";
export const COORDINATOR_VAT = "ESA12345678"; // NIF, CIF o VAT Number
export const COORDINATOR_REP = "Nombre del Representante Legal (Opcional)"; // Legal Representative (Optional)

export const TECH_PROVIDER_NAME = "ITACA-SABIEN, UPV";
export const getTechProviderUrlForLocale = (locale: string) =>
  "https://www.sabien.upv.es/" + (locale.toLowerCase() === 'es' ? "" : "en/");