export const PROJECT_NAME = 'AI-ASSISTANTS 4PID';
export const PROJECT_SUBTITLE = 'AI-Assisted Solutions for Enhancing the Independent Living of Persons with Intellectual Disabilities'
export const PROJECT_NUMBER_EU = '2025-1-DE02-KA220-ADU-000360510';

// --- SEO CONFIGURATION ---
export const SEO_TITLE = PROJECT_NAME + ' - Enhancing Independent Living of PIDs with AI Solutions';
export const SEO_DESCRIPTION = 'Discover how AI assistants are revolutionizing the lives of persons with intellectual disabilities (PID) by providing innovative solutions for independent living. Learn about our project, its goals, and the impact we aim to achieve.';
/**
 * Relative path to the social preview image for social media sharing (place it in the public/ folder)
 */
export const SEO_IMAGE = 'social-preview.png';

/**
 * Theme color, set as the primary color for the website, used in the "theme-color" meta tag for the address bar color on mobile devices
 */
export const THEME_COLOR = '#3BA6BC';

/**
 * This is the same as {@link PROJECT_NAME} but with spaces for screen readers to read it correctly
 */
export const PROJECT_NAME_FOR_SCREEN_READERS = 'A I Assistants For P I D';

export const COPYRIGHT_YEARS = '2026'; // Update with the actual year(s) of the project

export const CONTACT_EMAIL = 'ai4pid@upv.es';

// Info for the Imprint ("Aviso Legal" in Spanish)

// Coordinator: Info IAT
export const IAT_NAME = "Institut Arbeit und Technik";
export const IAT_ADDRESS = "Munscheidstraße 14, 45886 Gelsenkirchen, Deutschland";
export const IAT_EMAIL = "info@iat.eu";
export const IAT_LEGAL_REP = "Prof. Dr. Stefan Gärtner, geschäftsführender Direktor";

// Coordinator: Info main university from IAT (Westfälische Hochschule)
export const WH_NAME = "Westfälische Hochschule Gelsenkirchen Bocholt Recklinghausen";
export const WH_ADDRESS = "Neidenburger Straße 43, D-45897 Gelsenkirchen, Deutschland";
export const WH_PHONE = "+49 (0) 209-9596-0";
export const WH_EMAIL = "info@w-hs.de";
export const WH_VAT = "DE 811 358 679";
export const WH_LEGAL_REP = "Prof. Dr. Bernd Kriegesmann, President";

export const TECH_PROVIDER_NAME = "ITACA-SABIEN, UPV";
export const getTechProviderUrlForLocale = (locale: string) =>
  "https://www.sabien.upv.es/" + (locale.toLowerCase() === 'es' ? "" : "en/");


// List of partner names (and all their variations) to be preserved during translation, to avoid altering them in the translated text. This is important for proper nouns, organization names, and other specific terms that should remain unchanged across languages.
// Note: This is used for the LLM translation process to ensure that these names are not modified or mistranslated, which could lead to confusion or misrepresentation of the project and its partners.
export const PARTNER_NAMES = [
  'Universitat Politècnica de València', 'UPV',
  'Institute Work and Technology', 'Westphalian University of Applied Sciences', 'Institut für Arbeit und Technik', 'IAT',
  'CECD Mira Sintra', 'CECD',
  'AIAS Bologna ETS', 'AIAS Bologna', 'AIAS',
  'INESC-ID Lisboa', 'INESC-ID',
  'Fundación Amica', 'Amica',
  'ARFIE Network', 'ARFIE',
  'HURT'
];