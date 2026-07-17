<script lang="ts">
  import { setContext, type Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }
  let { children }: Props = $props();

  // Estado del juego con Svelte 5
  let score = $state(0);
  let totalAnswered = $state(0);

  // Exponemos una función global al resto de componentes hijos
  setContext('quiz-context', {
    addScore: (isCorrect: boolean) => {
      totalAnswered++;
      if (isCorrect) score++;
    }
  });
</script>

<div class="quiz-wrapper">
  <!-- Marcador superior elegante -->
  <div class="score-board">
    <span>Puntuación:</span>
    <span class="score-numbers">
      <strong>{score}</strong> / {totalAnswered}
    </span>
  </div>

  <!-- Aquí dentro se inyecta el Slideshow.astro -->
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
    color: #4ade80; /* Un verde vibrante para destacar el número de aciertos */
  }

  @media print {
    .score-board {
      display: none !important;
    }
  }
</style>