<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Answer } from '@core-types/quiz';

  interface Props {
    prompt: string;
    answers: Answer[];
  }
  let { prompt, answers }: Props = $props();

  // Estados locales con Svelte 5
  let status = $state<'playing' | 'revealed'>('playing');
  let selectedAnswer = $state<Answer | null>(null);

  // Referencia al contenedor HTML
  let container: HTMLElement;

  function guess(answer: Answer) {
    if (status === 'revealed') return;
    
    status = 'revealed';
    selectedAnswer = answer;
    
    // Sumamos al marcador global
    // Disparamos un evento nativo que "burbujeará" hacia arriba por el DOM
    container.dispatchEvent(new CustomEvent('quizanswer', {
      detail: { isCorrect: answer.isCorrect },
      bubbles: true, // ¡Clave! Permite que el evento suba hasta el Quiz
      composed: true
    }));
  }
</script>

<div class="question-container" class:is-revealed={status === 'revealed'} bind:this={container}>
  <h3 class="question-title">{prompt}</h3>

  <div class="buttons">
    {#each answers as ans}
      <button 
        class="answer-btn" 
        class:is-correct={status === 'revealed' && ans.isCorrect}
        class:is-wrong={status === 'revealed' && !ans.isCorrect && selectedAnswer === ans}
        class:dimmed={status === 'revealed' && selectedAnswer !== ans && !ans.isCorrect}
        onclick={() => guess(ans)}
        disabled={status === 'revealed'}
      >
        {ans.text}
      </button>
    {/each}
  </div>

  {#if status === 'revealed'}
    <div class="result-box" in:fade={{ duration: 300 }}>
      <h4 class="result-heading" class:success={selectedAnswer?.isCorrect} class:error={!selectedAnswer?.isCorrect}>
        {selectedAnswer?.isCorrect ? '✅ ¡Respuesta Correcta!' : '❌ Respuesta Incorrecta'}
      </h4>
      
      {#if selectedAnswer?.explanation}
        <p class="explanation">{selectedAnswer.explanation}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .question-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    text-align: center;
  }

  .question-title {
    font-size: 1.5rem;
    margin-bottom: 2rem;
    line-height: 1.4;
    color: var(--color-text);
  }

  /* Cuadrícula adaptada */
  .buttons {
    display: grid;
    grid-template-columns: 1fr; /* Móviles: 1 columna */
    gap: 1rem;
    width: 100%;
    margin-bottom: 2rem;
  }

  @media (min-width: 600px) {
    .buttons {
      grid-template-columns: repeat(2, 1fr); /* Desktop: 2 columnas */
    }
  }

  .answer-btn {
    background-color: #f1f5f9;
    border: 2px solid #cbd5e1;
    color: #334155;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    text-align: center;

    /* Overflow corrections for accessibility */
    padding: clamp(0.85rem, 3vw, 1.2rem) clamp(1.2rem, 4vw, 2rem);
    font-size: clamp(1rem, 3vw, 1.15rem);
    word-break: normal;
    overflow-wrap: break-word;
  }

  .answer-btn:hover:not(:disabled) {
    background-color: #e2e8f0;
    border-color: #94a3b8;
    transform: translateY(-2px);
  }

  /* Estados revelados (Estilos semánticos) */
  .answer-btn.is-correct {
    background-color: #dcfce7;
    border-color: #22c55e;
    color: #166534;
  }

  .answer-btn.is-wrong {
    background-color: #fee2e2;
    border-color: #ef4444;
    color: #991b1b;
  }

  .answer-btn.dimmed {
    opacity: 0.5;
    background-color: #f8fafc;
  }

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

  @media print {
    /* Revelamos todo para la impresión */
    .answer-btn.is-correct {
      background-color: #dcfce7 !important;
      border-color: #22c55e !important;
    }
  }
</style>