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

  // Variable para guardar las referencias de los clones
  let clonedSlides: HTMLElement[] | null = null;

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

  function cloneNodeBeforePrint(slide: HTMLElement | null) {
    if (!slide) return;

    // Nos aseguramos de que la slide original no tenga la clase no-print aún para que los clones no la copien sin querer (ya que los clones no deben tener la clase no-print, sino la clase print-only)
    slide.classList.remove('no-print');
    
    // Clonamos el nodo entero de la slide con sus hijos (deep clone)
    const clonedUnrevealedSlide = slide.cloneNode(true) as HTMLElement;

    const clonedUnrevealedSlideContainer = clonedUnrevealedSlide.querySelector<HTMLElement>('.question-container');
    if (!clonedUnrevealedSlideContainer) return;

    // Añadimos las siguientes clases CSS al primer container clonado para que se vea correctamente en el print:
    // 1. print-question-clone: para que se vea en el print y no se vea en pantalla, y aplique estilos específicos de print
    // 2. is-revealed: (este es solo para que el segundo nodo clonado se lo lleve sin tener que buscar en el DOM su container otra vez que es más costoso)
    // para que muestre la respuesta correcta en el segundo nodo clonado (ya que el primer clon sería la versión sin revelar, y el segundo clon sería la versión revelada)
    clonedUnrevealedSlideContainer.classList.add('print-question-clone', 'is-revealed');

    const clonedRevealedSlide = clonedUnrevealedSlide.cloneNode(true) as HTMLElement;

    // Nos aseguramos de que el contenedor del primer clon no tenga la clase is-revealed para que no se vea revelado en el print
    // (ya que el segundo clon es el que se mostrará revelado)
    clonedUnrevealedSlideContainer.classList.remove('is-revealed');

    // Nos aseguramos de que el details de explicaciones esté abierto en el clon revelado para que se vea en el print
    const detailsElement = clonedRevealedSlide.querySelector<HTMLDetailsElement>('details.explanations');
    if (detailsElement) detailsElement.open = true;

    // Usamos una clase CSS global especial para que solo se vean los clones en print y no en pantalla
    clonedUnrevealedSlide.classList.add('print-only'); 
    clonedRevealedSlide.classList.add('print-only');

    // En la slide original, inyectamos la clase CSS global especial no-print para que no se vea en print y solo se vea en pantalla
    slide.classList.add('no-print');

    // Inyectamos las slides clonadas justo debajo de la original
    // IMPORTANTE: Como usamos insertBefore, se van a inyectar en orden inverso, así que primero inyectamos la slide revelada y luego la no revelada para que se vea primero la no revelada y luego la revelada en el print
    if (slide.parentNode) {
      slide.parentNode.insertBefore(clonedRevealedSlide, slide.nextSibling);
      slide.parentNode.insertBefore(clonedUnrevealedSlide, slide.nextSibling);
    }

    // Nos guardamos las referencias de los clones para poder borrarlos después del print
    clonedSlides = [clonedUnrevealedSlide, clonedRevealedSlide];
  }

  function removeClonedNodesAfterPrint(slide: HTMLElement | null) {
    if (!slide) return;

    // Borramos los clones del DOM
    if (clonedSlides && clonedSlides.length > 0) {
      clonedSlides.forEach((clonedSlide) => {
        if (clonedSlide.parentNode) {
          clonedSlide.parentNode.removeChild(clonedSlide);
        }
      });
      clonedSlides = null;
    }
  }

  $effect(() => {
    if (!container) return;

    // Create closured functions for each event to keep the slide reference in all handlers
    const slide = findSlideElement();
    const beforePrintHandler = () => cloneNodeBeforePrint(slide);
    const afterPrintHandler = () => removeClonedNodesAfterPrint(slide);
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
      if (clonedSlides) {
        clonedSlides.forEach((clonedSlide) => {
          if (clonedSlide.parentNode) {
            clonedSlide.parentNode.removeChild(clonedSlide);
          }
        });
        clonedSlides = null;
      }

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
          <span class="answer-number">{index + 1})</span>{ans.explanation || "*"}
        </p>
      {/each}
      {#if answers.some(ans => !ans.explanation)}
        <p class="explanation-non-available-note">(*) {localizedTexts?.printAnswerNoExplanationLabel || 'No explanation available for this answer'}</p>
      {/if}
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
  .question-container.is-revealed:not(.print-question-clone) .answer-btn {
    opacity: 0.5;
    background-color: #f8fafc;
  }

  /* Incorrect answer, selected (highlighted in red) */
  .question-container.is-revealed:where(:not(.print-question-clone)) .answer-btn.is-selected {
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

  .explanation-non-available-note {
    font-style: italic;
    color: #64748b;
    margin-top: 0.5rem;
  }

  /* NOTE: We don't control the visibility of the original and cloned slides from CSS here because, since the slides are parent elements, we would need to use the :has() pseudo-class, which is not supported in all browsers yet. Instead, we inject global CSS classes "print-only" and "no-print" via JS to the original and cloned slide elements, so that the CSS style is apply from the top and works on all browsers */
  @media print {
    /* Como en print se fuerza el fondo blanco en el global para ahorrar tinta, le ponemos un emoji de check verde detrás de la respuesta correcta para que se vea bien */
    .question-container.is-revealed .answer-btn.is-correct::after {
      content: ' ✅';
    }

    /* Ocultamos el icono del details de explicaciones en print para que no se vea el triángulo (ya que no aporta nada en print) */
    .explanations .explanations-summary::marker {
      content: '';
    }
  }
</style>