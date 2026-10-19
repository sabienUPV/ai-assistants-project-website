/**
 * @deprecated — This file is a thin compatibility wrapper.
 * All logic has been moved to `@core` (`packages/core/src/utils/llm/`).
 *
 * Import directly from `@core-utils/llm` or `@core-utils/llm/translator`
 * in new code.
 */
export {
  DEFAULT_OLLAMA_URL,
  DEFAULT_LLM_MODEL,
  PROTECTED_PATTERNS,
  translateText,
} from '@core-utils/llm/translator.js';

export { processMarkdocDocument as processDocument } from '@core-utils/llm/processors/process-markdoc.js';