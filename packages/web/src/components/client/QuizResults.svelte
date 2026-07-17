<script lang="ts">
  interface Props {
    localizedTexts?: {
      perfectScoreLabel?: string;
      niceTryLabel?: string;
      playAgainLabel?: string;
    };
  }
  let { localizedTexts }: Props = $props();

  let score = $state(0);
  let total = $state(0);
  let container: HTMLElement;

  $effect(() => {
    if (!container) return;

    // Escuchamos si la nota cambia en tiempo real
    const handleScoreUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{score: number, total: number}>;
      score = customEvent.detail.score;
      total = customEvent.detail.total;
    };
    container.addEventListener('scorechanged', handleScoreUpdate);

    // Pedimos la nota actual inmediatamente enviando un callback hacia arriba
    container.dispatchEvent(new CustomEvent('requestscore', {
      bubbles: true,
      composed: true,
      detail: { 
        callback: (s: number, t: number) => { score = s; total = t; } 
      }
    }));

    return () => container.removeEventListener('scorechanged', handleScoreUpdate);
  });

  function restartGame() {
    // 1. Avisamos al Quiz de que ponga los marcadores a 0
    container.dispatchEvent(new Event('resetquiz', { bubbles: true, composed: true }));
    
    // 2. Avisamos al Slideshow de que nos lleve a la diapositiva 0 (la portada)
    container.dispatchEvent(new CustomEvent('gotoslide', {
      bubbles: true, 
      composed: true, 
      detail: { index: 0 }
    }));
  }
</script>

<div class="quiz-results-container" bind:this={container}>
  <div class="score-display">
    <span class="score-number">{score}</span>
    <span class="score-divider">/</span>
    <span class="score-total">{total}</span>
  </div>
  
  <p class="score-message">
    {score === total ? localizedTexts?.perfectScoreLabel || 'Perfect score! You are amazing.' : localizedTexts?.niceTryLabel || 'Nice try! Review the concepts and try again.'}
  </p>

  <button class="restart-btn" onclick={restartGame}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    {localizedTexts?.playAgainLabel || 'Play Again'}
  </button>
</div>

<style>
  .quiz-results-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
  }

  .score-display {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 2rem;
    color: var(--color-logo-dark-grey);
  }

  .score-number {
    font-size: 5rem;
    font-weight: 900;
    color: var(--color-primary, #3b82f6);
  }

  .score-message {
    font-size: 1.25rem;
    text-align: center;
    color: var(--color-text);
  }

  .restart-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background-color: var(--color-secondary);
    color: white;
    font-size: 1.25rem;
    font-weight: bold;
    padding: 1rem 2rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
  }

  .restart-btn:hover {
    transform: translateY(-2px);
    opacity: 0.9;
  }
</style>