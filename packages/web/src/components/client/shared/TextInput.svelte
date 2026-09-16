<script lang="ts">
  import { IS_AI_INTEGRATION_ENABLED } from '@core-utils/ai-integration'; 
  import { AI_LLM_API_URL } from '@constants';

  // Define component props using the $props() rune
  let {
    contextForAI = undefined,
    maxCharacters = 500,
    placeholderText,
    buttonText,
    loadingMessage,
    errorMessage,
    tooLongMessage
  }: {
    contextForAI?: string;
    maxCharacters?: number;
    placeholderText: string;
    buttonText: string;
    loadingMessage: string;
    errorMessage: string;
    tooLongMessage: string;
  } = $props();

  // Component state using the $state() rune
  let userText = $state('');
  let feedbackText = $state('');
  let feedbackStatus = $state<'loading' | 'success' | 'error' | null>(null);

  // Derived reactive variables using the $derived() rune
  let currentLength = $derived(userText.length);
  let isOverLimit = $derived(currentLength > maxCharacters);
  let isEmpty = $derived(userText.trim().length === 0);
  let isLoading = $derived(feedbackStatus === 'loading');
  let isButtonDisabled = $derived(isOverLimit || isEmpty || isLoading);

  let aiIntegrationEnabled = $derived(import.meta.env.DEV || (IS_AI_INTEGRATION_ENABLED && contextForAI));

  // Clear feedback when the user modifies the text
  function handleInput() {
    feedbackText = '';
    feedbackStatus = null;
  }

  async function checkResponse() {
    if (isButtonDisabled) return;

    const trimmedText = userText.trim();
    feedbackStatus = 'loading';
    feedbackText = loadingMessage;

    try {
      if (AI_LLM_API_URL) {
        // TODO: Actual API call when the AI service is fully implemented
        const response = await fetch(AI_LLM_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userText: trimmedText, context: contextForAI }),
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        feedbackText = data.message || 'Feedback received.';
      } else {
        // TODO: Remove this simulated response once the AI integration is connected
        await new Promise(resolve => setTimeout(resolve, 1500));
        feedbackText = `SIMULATED RESPONSE: The AI would say that your message is great, but it's missing the time.\n\nText:\n"${trimmedText}"\n\nContext:\n"${contextForAI}"`;
      }
      feedbackStatus = 'success';
    } catch (error) {
      feedbackText = errorMessage;
      feedbackStatus = 'error';
    }
  }
</script>

<div class="text-input-container">
  <div class="textarea-container">
    <!-- Svelte automatically toggles the error classes based on the isOverLimit state -->
    <textarea 
      class="prompt-textarea" 
      class:error-border={isOverLimit}
      class:error-text={isOverLimit}
      placeholder={placeholderText}
      rows="4"
      bind:value={userText}
      oninput={handleInput}
    ></textarea>
    
    <div class="textarea-validation-container">
      {#if currentLength > 0}
        <span class="textarea-character-count" class:error-text={isOverLimit}>
          {currentLength}/{maxCharacters}
        </span>
      {/if}
      
      {#if isOverLimit}
        <span class="textarea-error-message">
          {tooLongMessage}
        </span>
      {/if}
    </div>
  </div>

  {#if aiIntegrationEnabled}
    <div class="ai-interaction-zone">
      <button 
        class="check-btn" 
        type="button"
        disabled={isButtonDisabled}
        onclick={checkResponse}
      >
        {buttonText}
      </button>
      
      {#if feedbackText}
        <div class="ai-feedback {feedbackStatus}" aria-live="polite">
          {feedbackText}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Structural CSS */
  .text-input-container { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 800px; }
  .textarea-container { display: flex; flex-direction: column; gap: 0.5rem; }
  
  .prompt-textarea {
    width: 100%; padding: 1rem; border: 2px solid #cbd5e1; border-radius: 8px;
    font-family: inherit; font-size: 1.1rem; resize: vertical; transition: border-color 0.2s;
  }
  .prompt-textarea:focus { outline: none; border-color: var(--color-primary, #3b82f6); }
  
  /* Reactive error classes injected by Svelte */
  .error-border { border-color: #ef4444 !important; }
  .error-text { color: #ef4444 !important; }

  .textarea-validation-container { display: flex; flex-direction: column; gap: 0.25rem; }
  .textarea-character-count { font-size: 0.9rem; color: #64748b; }
  .textarea-error-message { font-size: 0.9rem; color: #ef4444; }

  .ai-interaction-zone { display: flex; flex-direction: column; align-items: flex-start; gap: 1rem; }
  .check-btn {
    background-color: var(--color-secondary, #1e293b); color: white; padding: 0.75rem 1.5rem;
    border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
  }
  .check-btn:hover:not(:disabled) { opacity: 0.9; }
  .check-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .ai-feedback {
    width: 100%; padding: 1rem; border-radius: 8px; background-color: #f8fafc;
    border-left: 4px solid #94a3b8; white-space: pre-wrap;
  }
  .success { border-left-color: #22c55e; background-color: #f0fdf4; }
  .error { border-left-color: #ef4444; background-color: #fef2f2; }
  .loading { animation: pulse 1.5s infinite; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>