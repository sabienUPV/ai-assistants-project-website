// ============================================================
// Public API for @core LLM translation utilities
// ============================================================

// Core engine
export {
  translateText,
  PROTECTED_PATTERNS,
  containsAnyLetterOrNumberRegex,
  DEFAULT_OLLAMA_URL,
  DEFAULT_LLM_MODEL,
  type TranslateOptions,
} from './translator.js';

// Format-specific processors
export { processMarkdocDocument } from './processors/process-markdoc.js';
export {
  processCsvDocument,
  DEFAULT_SKIP_COLUMNS,
  resolveTranslatableHeaders,
  type CsvTranslateOptions,
} from './processors/process-csv.js';

// CLI and path resolution
export {
  runCli,
  resolveOutputPath,
  type CliOptions,
  type RunCliOptions,
} from './cli.js';
