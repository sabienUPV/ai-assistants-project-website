import { AI_LLM_API_URL } from "@constants";

export const IS_AI_INTEGRATION_ENABLED = AI_LLM_API_URL != null; // This will be true if the AI/LLM API URL is set, false otherwise (note: using != null instead of !== null to also catch undefined). This constant can be used throughout the application to conditionally enable or disable features that depend on the AI/LLM service.