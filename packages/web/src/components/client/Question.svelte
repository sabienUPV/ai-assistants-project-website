<script lang="ts">
  import type { Answer } from '@core-types/quiz';

  interface Props {
    prompt: string;
    answers: Answer[];
    localizedTexts?: {
      correctAnswerLabel?: string;
      incorrectAnswerLabel?: string;
      printAnswerExplanationsLabel?: string;
      printAnswerNoExplanationLabel?: string;
    };
  }
  const { prompt, answers, localizedTexts }: Props = $props();

  // Estados locales con Svelte 5
  let status = $state<'playing' | 'revealed'>('playing');
  let selectedAnswer = $state<Answer | null>(null);

  // Referencia al contenedor HTML
  let container: HTMLElement;

  // Variable para guardar la referencia del clon
  let clonedSlide: HTMLElement | null = null;

  function findSlideElement() {
    return container.closest<HTMLElement>('.markdoc-slide');
  }

  function guess(answer: Answer) {
    if (status === 'revealed') return;
    
    status = 'revealed';
    selectedAnswer = answer;

    // Al responder, desbloqueamos la diapositiva padre
    // (Nota: Como este evento se usa en el botón de cada respuesta, no podemos hacer closure de la slide (bueno, podríamos pero no merece la pena en este caso), así que la buscamos en el DOM directamente)
    const slide = findSlideElement();
    if (slide) slide.dataset.locked = 'false';
    
    // Sumamos al marcador global
    // Disparamos un evento nativo que "burbujeará" hacia arriba por el DOM
    container.dispatchEvent(new CustomEvent('quizanswer', {
      detail: { isCorrect: answer.isCorrect },
      bubbles: true, // ¡Clave! Permite que el evento suba hasta el Quiz
      composed: true
    }));

    // Disparamos evento para avisar al Slideshow de que esta slide ya no está bloqueada
    container.dispatchEvent(new CustomEvent('slidelockchange', { 
      bubbles: true, 
      composed: true 
    }));
  }

  // Función para devolver la pregunta a su estado inicial
  function resetQuestion(slide: HTMLElement | null) {
    status = 'playing';
    selectedAnswer = null;
    
    // Volvemos a echar el cerrojo a la diapositiva (para que el usuario no pueda avanzar sin responder)
    if (slide) slide.dataset.locked = 'true';
  }

  function cloneNodeForAnswerKeyBeforePrint(slide: HTMLElement | null) {
    if (!slide) return;

    // Añadimos las siguientes clases CSS al container original
    // (para que lo clone y no tengamos que buscar otra vez en el DOM el container clonado, que es más costoso)
    // para que se vea correctamente en el print:
    // 1. print-answer-key: para que no muestre los otros nodos dimmed en el print
    // 2. is-revealed: para que muestre la respuesta correcta en el nodo clonado
    container.classList.add('print-answer-key', 'is-revealed');
    
    // Clonamos el nodo entero de la slide con sus hijos (deep clone)
    clonedSlide = slide.cloneNode(true) as HTMLElement;
    
    // Nos aseguramos de que el contenedor original no tenga la clase is-revealed para que no se vea revelado en el print
    // (ya que el clon es el que se mostrará revelado)
    // Además, quitamos la clase temporal print-answer-key que era solo para el clon
    container.classList.remove('print-answer-key', 'is-revealed');

    // Nos aseguramos de que el details de explicaciones esté abierto en el clon para que se vea en el print
    const detailsElement = clonedSlide.querySelector<HTMLDetailsElement>('details.explanations');
    if (detailsElement) detailsElement.open = true;

    // Inyectamos la slide clonada justo debajo de la original
    slide.parentNode?.insertBefore(clonedSlide, slide.nextSibling);
  }

  function removeAnswerKeyNodeAfterPrint(slide: HTMLElement | null) {
    if (!slide) return;

    // 1. Borramos el clon del DOM
    if (clonedSlide && clonedSlide.parentNode) {
      clonedSlide.parentNode.removeChild(clonedSlide);
      clonedSlide = null;
    }
    
    // 2. Si la pregunta estaba en estado "revealed", volvemos a poner la clase CSS is-revealed en el question-container original (ya que se la habíamos quitado para el print para que fuera el clon el que mostraba la pregunta revelada con su estilo propio)
    if (status === 'revealed') {
      container.classList.add('is-revealed');
    }
  }

  $effect(() => {
    if (!container) return;

    // Create closured functions for each event to keep the slide reference in all handlers
    const slide = findSlideElement();
    const beforePrintHandler = () => cloneNodeForAnswerKeyBeforePrint(slide);
    const afterPrintHandler = () => removeAnswerKeyNodeAfterPrint(slide);
    const resetQuestionHandler = () => resetQuestion(slide);

    window.addEventListener('beforeprint', beforePrintHandler);
    window.addEventListener('afterprint', afterPrintHandler);
    
    // Escuchamos la orden de reinicio que viene desde arriba
    container.addEventListener('resetquestion', resetQuestionHandler);

    // (DEBUG/DEV ONLY) Creamos funciones de test para poder probar el clonado desde la consola del navegador sin tener que abrir el diálogo de impresión
    if (import.meta.env.DEV) {
      // Nos inventamos un evento custom que sea idéntico a beforeprint y afterprint pero que solo llame a nuestros handlers
      window.addEventListener('testbeforeprint', beforePrintHandler);
      window.addEventListener('testafterprint', afterPrintHandler);

      // Exponemos funciones al objeto window del navegador que mandan el evento testbeforeprint y testafterprint para poder probarlo desde la consola del navegador
      // Puedes llamarlas escribiendo testBeforePrint() o testAfterPrint() en la consola
      if (!(window as any).testBeforePrint) {
        (window as any).testBeforePrint = () => {
          console.log('🖨️ [DEV] Simulando beforeprint...');
          window.dispatchEvent(new Event('testbeforeprint'));
        };
      }
      
      if (!(window as any).testAfterPrint) {
        (window as any).testAfterPrint = () => {
          console.log('🧹 [DEV] Simulando afterprint...');
          window.dispatchEvent(new Event('testafterprint'));
        };
      }
    }
    
    return () => {
      container.removeEventListener('resetquestion', resetQuestionHandler);
      window.removeEventListener('beforeprint', beforePrintHandler);
      window.removeEventListener('afterprint', afterPrintHandler);

      // Limpieza de seguridad por si el componente se destruye con el diálogo abierto
      if (clonedSlide?.parentNode) clonedSlide.parentNode.removeChild(clonedSlide);

      // (DEBUG/DEV ONLY) Limpiamos los event listeners de test al destruir el componente
      if (import.meta.env.DEV) {
        window.removeEventListener('testbeforeprint', beforePrintHandler);
        window.removeEventListener('testafterprint', afterPrintHandler);
      }
    }
  });
</script>

<div class="question-container" class:is-revealed={status === 'revealed'} bind:this={container}>
  <h3 class="question-title">{prompt}</h3>

  <div class="buttons">
    {#each answers as ans, index}
      <button 
        class="answer-btn"
        // Note: We know this reveals the answer if you check the CSS. If you found this, good for you. But since our courses are public, for educational purposes, and don't give any qualifications, we don't need anti-cheat measures.
        class:is-correct={ans.isCorrect}
        class:is-selected={selectedAnswer === ans}
        onclick={() => guess(ans)}
        disabled={status === 'revealed'}
      >
        <span class="answer-number">{index + 1})</span>{ans.text}
      </button>
    {/each}
  </div>

  <div class="result-box">
    {#if status === 'revealed' && selectedAnswer}
      <div class="result-selected-box">
        <h4 class="result-selected-heading" class:success={selectedAnswer.isCorrect} class:error={!selectedAnswer.isCorrect}>
          {selectedAnswer.isCorrect ? ('✅ ' + (localizedTexts?.correctAnswerLabel || 'Correct Answer!')) : ('❌ ' + (localizedTexts?.incorrectAnswerLabel || 'Incorrect Answer'))}
        </h4>
        
        {#if selectedAnswer.explanation}
          <p class="explanation">{selectedAnswer.explanation}</p>
        {/if}
      </div>
    {/if}

    <!-- Note: We know that you can check the explanations if you check the CSS or print version, which could give away the answers. But since our courses are public, for educational purposes, and don't give any qualifications, we don't need anti-cheat measures. So if you cheat, it's your responsibility -->
    <details class="explanations">
      <summary class="explanations-summary">{localizedTexts?.printAnswerExplanationsLabel || 'Explanation of each answer'}</summary>
      {#each answers as ans, index}
        <p class="explanation" style={!ans.explanation ? "font-style: italic;" : ""}>
          <span class="answer-number">{index + 1})</span> {ans.explanation || `[${localizedTexts?.printAnswerNoExplanationLabel || 'No explanation available for this answer.'}]`}
        </p>
      {/each}
    </details>
  </div>
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

  .answer-number {
    font-weight: bold;
    margin-right: 0.5rem;
  }

  .answer-number {
    display: none; /* Ocultamos el número de respuesta por defecto */
  }

  .question-container.is-revealed .answer-number {
    display: inline; /* Mostramos el número de respuesta si la pregunta está revelada */
  }

  /* Estados revelados (Estilos semánticos) */

  /* NOTE: In order to simplify the CSS and make it more efficient, we use defaults with overrides to avoid extra checks. We first apply styles unselected and incorrect answers, then we override them for both selected incorrect answers and for correct answers. Since we use the same few styles in all cases, this does not add much overhead in terms of extra overrides, while making the CSS selectors way simpler, which is what matters most in terms of performance. */

  /* Incorrect answer, not selected (dimmed by default) */
  .question-container.is-revealed:not(.print-answer-key) .answer-btn {
    opacity: 0.5;
    background-color: #f8fafc;
  }

  /* Incorrect answer, selected (highlighted in red) */
  .question-container.is-revealed:where(:not(.print-answer-key)) .answer-btn.is-selected {
    opacity: 1;
    background-color: #fee2e2;
    border-color: #ef4444;
    color: #991b1b;
  }

  /* Correct answer */
  .question-container.is-revealed .answer-btn.is-correct {
    opacity: 1;
    background-color: #dcfce7;
    border-color: #22c55e;
    color: #166534;
  }

  /* Result box styles */

  /* NOTE: We handle the visibility of the result box with CSS, because we want the explanations to be displayed on print, regardless of whether the question is revealed or not. However, its title and correct answer explanation are controlled by Svelte instead because we never want to display that on print */
  .result-box {
    display: none; /* Hidden by default */
  }
  .question-container.is-revealed .result-box {
    display: block; /* Show when the question is revealed */
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

  .result-selected-heading {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
  }

  .result-selected-heading.success { color: #166534; }
  .result-selected-heading.error { color: #991b1b; }

  .explanation {
    margin: 0;
    font-size: 1.05rem;
    color: #475569;
    line-height: 1.5;
  }

  .explanations {
    margin: 0;
    margin-top: 1rem;
    font-size: 1.05rem;
    color: #475569;
    line-height: 1.5;
  }

  .explanations .explanations-summary {
    cursor: pointer;
    font-weight: 600;
    color: #1e3a8a;
  }

  .explanations[open] .explanations-summary {
    color: #1e40af;
  }

  .explanations .explanation {
    margin: 0.5rem 0 0 1rem;
  }

  @media print {
    /* Como en print se fuerza el fondo blanco en el global para ahorrar tinta, le ponemos un emoji de check verde detrás de la respuesta correcta para que se vea bien */
    .question-container.is-revealed .answer-btn.is-correct::after {
      content: ' ✅';
    }

    /* NOTE: The :global keyword here tells Svelte to trust us that .print-answer-key will be there even if it can't notice because we are injecting that class via JS */
    /* Reference: https://svelte.dev/docs/svelte/compiler-warnings#css_unused_selector */
    .question-container:where(:global(.print-answer-key)) .answer-number {
      display: inline; /* Mostramos el número de respuesta siempre en print */
    }

    /* Ocultamos el icono del details de explicaciones en print para que no se vea el triángulo (ya que no aporta nada en print) */
    .explanations .explanations-summary::marker {
      content: '';
    }
  }
</style>