<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    localizedTexts?: {
      scoreLabel?: string;
    };
  }
  let { children, localizedTexts }: Props = $props();

  // Estado del juego con Svelte 5
  let score = $state(0);
  let totalAnswered = $state(0);

  // 1. Creamos una referencia al elemento del DOM
  let wrapper: HTMLElement;

  // 2. Usamos $effect para añadir el listener cuando el componente se monta
  $effect(() => {
    if (!wrapper) return;

    // Nuestro manejador tipado
    const handleQuizAnswer = (event: Event) => {
      // Casteamos el evento genérico al nuestro personalizado
      const customEvent = event as CustomEvent<{ isCorrect: boolean }>;
      
      totalAnswered++;
      if (customEvent.detail.isCorrect) score++;
    };

    // Añadimos el listener de forma nativa
    wrapper.addEventListener('quizanswer', handleQuizAnswer);

    // Limpieza al desmontar (muy importante para evitar memory leaks)
    return () => {
      wrapper.removeEventListener('quizanswer', handleQuizAnswer);
    };
  });
</script>

<div class="quiz-wrapper" bind:this={wrapper}>
  <!-- Marcador superior elegante -->
  <div class="score-board">
    <span>{localizedTexts?.scoreLabel || 'Score'}:</span>
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