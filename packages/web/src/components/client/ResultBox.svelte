<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Answer } from '@core-types/quiz';

  interface Props {
    // We allow null or undefined for selectedAnswer to handle cases where no answer has been selected yet
    // (this should not happen because the caller should be handling this already, but we add this for type safety)
    selectedAnswer: Answer | null | undefined;
    localizedTexts?: {
      correctAnswerLabel?: string;
      incorrectAnswerLabel?: string;
    };
  }
  const { selectedAnswer, localizedTexts }: Props = $props();
</script>

{#if selectedAnswer}
  <div class="result-box" in:fade={{ duration: 300 }}>
    <h4 class="result-heading" class:success={selectedAnswer.isCorrect} class:error={!selectedAnswer.isCorrect}>
      {selectedAnswer.isCorrect ? ('✅ ' + (localizedTexts?.correctAnswerLabel || 'Correct Answer!')) : ('❌ ' + (localizedTexts?.incorrectAnswerLabel || 'Incorrect Answer'))}
    </h4>
    
    {#if selectedAnswer.explanation}
      <p class="explanation">{selectedAnswer.explanation}</p>
    {/if}
  </div>
{/if}

<style>
  .result-box {
    background: #f8fafc;
    border-left: 4px solid #3b82f6;
    padding: 1.5rem;
    border-radius: 0.5rem;
    width: 100%;
    text-align: left;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .result-heading {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
  }

  .result-heading.success { color: #166534; }
  .result-heading.error { color: #991b1b; }

  .explanation {
    margin: 0;
    font-size: 1.05rem;
    color: #475569;
    line-height: 1.5;
  }
</style>