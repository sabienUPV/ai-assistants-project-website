<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    embedded?: boolean;
    localizedTexts?: {
      scoreLabel?: string;
    };
  }
  let { children, embedded = false, localizedTexts }: Props = $props();

  // Quiz state is managed with Svelte 5.
  let score = $state(0);
  let totalAnswered = $state(0);

  // Reference to the quiz wrapper element.
  let wrapper: HTMLElement;

  // Add event listeners when the component mounts.
  $effect(() => {
    if (!wrapper) return;

    // Handle the typed custom event.
    const handleQuizAnswer = (event: Event) => {
      // Cast the generic event to its custom event type.
      const customEvent = event as CustomEvent<{ isCorrect: boolean }>;
      
      totalAnswered++;
      if (customEvent.detail.isCorrect) score++;

      // Notify the results component that the score changed.
      wrapper.querySelectorAll('.quiz-results-container').forEach(el => {
        el.dispatchEvent(new CustomEvent('scorechanged', {
          detail: { score, total: totalAnswered }
        }));
      });
    };

    // Respond to score requests through the supplied callback.
    const handleRequestScore = (event: Event) => {
      const customEvent = event as CustomEvent<{ callback: (s: number, t: number) => void }>;
      customEvent.detail.callback(score, totalAnswered);
    };

    // Reset the quiz state.
    const handleResetQuiz = () => {
      score = 0;
      totalAnswered = 0;
      
      // Notify every question to reset its state.
      wrapper.querySelectorAll('.question-container').forEach(el => {
        el.dispatchEvent(new Event('resetquestion'));
      });
      
      // Clear the displayed results.
      wrapper.querySelectorAll('.quiz-results-container').forEach(el => {
        el.dispatchEvent(new CustomEvent('scorechanged', { detail: { score: 0, total: 0 } }));
      });
    };

    // Listen for events bubbling up from question components.
    wrapper.addEventListener('quizanswer', handleQuizAnswer);
    wrapper.addEventListener('requestscore', handleRequestScore);
    wrapper.addEventListener('resetquiz', handleResetQuiz);

    // Remove listeners when the component is destroyed.
    return () => {
      wrapper.removeEventListener('quizanswer', handleQuizAnswer);
      wrapper.removeEventListener('requestscore', handleRequestScore);
      wrapper.removeEventListener('resetquiz', handleResetQuiz);
    };
  });
</script>

<div class="quiz-wrapper" data-embedded={embedded ? 'true' : 'false'} bind:this={wrapper}>
  <!-- Quiz score -->
  <div class="score-board">
    <span>{localizedTexts?.scoreLabel || 'Score'}:</span>
    <span class="score-numbers">
      <strong>{score}</strong> / {totalAnswered}
    </span>
  </div>

  <!-- Quiz slides are rendered here. -->
  <div class="quiz-content">
    {@render children?.()}
  </div>
</div>

<style>
  .quiz-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin: 2rem 0;
  }

  .score-board {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--color-secondary, #1e293b);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 1.25rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .score-numbers strong {
    font-size: 1.5rem;
    color: #4ade80; /* Highlight the correct-answer count. */
  }

  @media print {
    .score-board {
      display: none !important;
    }
  }
</style>