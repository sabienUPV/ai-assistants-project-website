<script lang="ts">
  import type { Answer } from '@core-types/quiz';

  interface Props {
    prompt: string;
    image?: string;
    imageAlt?: string;
    answers: Answer[];
    localizedTexts?: {
      correctAnswerLabel?: string;
      incorrectAnswerLabel?: string;
      printAnswerExplanationsLabel?: string;
      printAnswerNoExplanationLabel?: string;
    };
  }
  const { prompt, image, imageAlt, answers, localizedTexts }: Props = $props();

  // Local state for the question.
  let status = $state<'playing' | 'revealed'>('playing');
  let selectedAnswer = $state<Answer | null>(null);

  // Reference to the question container.
  let container: HTMLElement;

  // References to the slide clones used for printing.
  let clonedSlides: HTMLElement[] | null = null;

  function findSlideElement() {
    return container.closest<HTMLElement>('.markdoc-slide');
  }

  function guess(answer: Answer) {
    if (status === 'revealed') return;
    
    status = 'revealed';
    selectedAnswer = answer;

    // Unlock the parent slide after an answer is selected.
    // Find the slide in the DOM because the answer button handler does not capture it.
    const slide = findSlideElement();
    if (slide) slide.dataset.locked = 'false';
    
    // Update the global score through a bubbling DOM event.
    container.dispatchEvent(new CustomEvent('quizanswer', {
      detail: { isCorrect: answer.isCorrect },
      bubbles: true, // Allow the event to bubble up to the quiz.
      composed: true
    }));

    // Notify the slideshow that this slide is no longer locked.
    container.dispatchEvent(new CustomEvent('slidestatechanged', { 
      bubbles: true, 
      composed: true 
    }));
  }

  // Restore the question to its initial state.
  function resetQuestion(slide: HTMLElement | null) {
    status = 'playing';
    selectedAnswer = null;
    
    // Lock the slide until the question is answered again.
    if (slide) slide.dataset.locked = 'true';
  }

  function cloneNodeBeforePrint(slide: HTMLElement | null) {
    if (!slide) return;

    // Keep the original slide's print classes off the clones.
    slide.classList.remove('no-print');
    
    // Clone the slide and all its children.
    const clonedUnrevealedSlide = slide.cloneNode(true) as HTMLElement;

    const clonedUnrevealedSlideContainer = clonedUnrevealedSlide.querySelector<HTMLElement>('.question-container');
    if (!clonedUnrevealedSlideContainer) return;

    // Mark the first clone for print-only rendering and revealed-answer styling.
    // The revealed clone inherits this class before it is removed from the first clone.
    clonedUnrevealedSlideContainer.classList.add('print-question-clone', 'is-revealed');

    const clonedRevealedSlide = clonedUnrevealedSlide.cloneNode(true) as HTMLElement;

    // Keep the first clone unrevealed; the second clone shows the revealed answer.
    clonedUnrevealedSlideContainer.classList.remove('is-revealed');

    // Open the explanations in the revealed clone for printing.
    const detailsElement = clonedRevealedSlide.querySelector<HTMLDetailsElement>('details.explanations');
    if (detailsElement) detailsElement.open = true;

    // Show the clones only in print.
    clonedUnrevealedSlide.classList.add('print-only'); 
    clonedRevealedSlide.classList.add('print-only');

    // Hide the original slide in print.
    slide.classList.add('no-print');

    // Insert the clones below the original. Insert the revealed clone first so the
    // unrevealed version appears before it in the printed document.
    if (slide.parentNode) {
      slide.parentNode.insertBefore(clonedRevealedSlide, slide.nextSibling);
      slide.parentNode.insertBefore(clonedUnrevealedSlide, slide.nextSibling);
    }

    // Keep references so the clones can be removed after printing.
    clonedSlides = [clonedUnrevealedSlide, clonedRevealedSlide];
  }

  function removeClonedNodesAfterPrint(slide: HTMLElement | null) {
    if (!slide) return;

    // Remove the print clones from the DOM.
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
    
    // Listen for reset events from the parent quiz.
    container.addEventListener('resetquestion', resetQuestionHandler);

    // Development-only helpers for testing print cloning without opening the print dialog.
    if (import.meta.env.DEV) {
      // Simulate beforeprint and afterprint using the same handlers.
      window.addEventListener('testbeforeprint', beforePrintHandler);
      window.addEventListener('testafterprint', afterPrintHandler);

      // Expose console helpers named testBeforePrint() and testAfterPrint().
      if (!(window as any).testBeforePrint) {
        (window as any).testBeforePrint = () => {
          console.log('🖨️ [DEV] Simulating beforeprint...');
          window.dispatchEvent(new Event('testbeforeprint'));
        };
      }
      
      if (!(window as any).testAfterPrint) {
        (window as any).testAfterPrint = () => {
          console.log('🧹 [DEV] Simulating afterprint...');
          window.dispatchEvent(new Event('testafterprint'));
        };
      }
    }
    
    return () => {
      container.removeEventListener('resetquestion', resetQuestionHandler);
      window.removeEventListener('beforeprint', beforePrintHandler);
      window.removeEventListener('afterprint', afterPrintHandler);

      // Clean up cloned nodes if the component is destroyed while printing.
      if (clonedSlides) {
        clonedSlides.forEach((clonedSlide) => {
          if (clonedSlide.parentNode) {
            clonedSlide.parentNode.removeChild(clonedSlide);
          }
        });
        clonedSlides = null;
      }

      // Remove development-only test listeners when the component is destroyed.
      if (import.meta.env.DEV) {
        window.removeEventListener('testbeforeprint', beforePrintHandler);
        window.removeEventListener('testafterprint', afterPrintHandler);
      }
    }
  });
</script>

<div class="question-container" class:is-revealed={status === 'revealed'} bind:this={container}>
  <div class="question-prompt">
    {#if image}
      <img class="question-image" src={image} alt={imageAlt ?? ''} loading="lazy" decoding="async" />
    {/if}
    <h3 class="question-title">{prompt}</h3>
  </div>

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
        <span class="answer-number">{index + 1})</span>
        <span class="answer-content">
          {#if ans.image}
            <img class="answer-image" src={ans.image} alt={ans.imageAlt ?? ''} loading="lazy" decoding="async" />
          {/if}
          {#if ans.text}
            <span class="answer-text">{ans.text}</span>
          {/if}
        </span>
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
        <p class="explanation" class:not-available={!ans.explanation}>
          <span class="answer-number">{index + 1})</span><span class="answer-text">{ans.explanation || "*"}</span>
        </p>
      {/each}
      {#if answers.some(ans => !ans.explanation)}
        <p class="explanations-non-available-note not-available">(*) {localizedTexts?.printAnswerNoExplanationLabel || 'No explanation available for this answer'}</p>
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
    margin: 0;
    line-height: 1.4;
    color: var(--color-text);
  }

  .question-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .question-image {
    display: block;
    width: auto;
    max-width: min(100%, 22rem);
    max-height: 16rem;
    object-fit: contain;
  }

  /* Responsive answer grid. */
  .buttons {
    display: grid;
    grid-template-columns: 1fr; /* One column on small screens. */
    gap: 1rem;
    width: 100%;
    margin-bottom: 2rem;
  }

  @media (min-width: 600px) {
    .buttons {
      grid-template-columns: repeat(2, 1fr); /* Two columns on wider screens. */
    }
  }

  @media screen and (max-width: 1000px) {
    :global(html.easy-to-read) .buttons {
      grid-template-columns: 1fr;
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
    display: none; /* Hide answer numbers until the question is revealed. */
  }

  .answer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .answer-image {
    display: block;
    width: auto;
    max-width: min(100%, 6rem);
    max-height: 6rem;
    object-fit: contain;
  }

  .question-container.is-revealed .answer-number {
    display: inline; /* Show answer numbers after the question is revealed. */
  }

  /* Revealed-state styles. */

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
  }

  .result-selected-heading.success { color: #166534; }
  .result-selected-heading.error { color: #991b1b; }

  .explanation {
    margin: 0;
    color: #475569;
    line-height: 1.5;
  }

  .explanations {
    margin: 0;
    margin-top: 1rem;
    color: #475569;
    line-height: 1.5;
  }

  .explanations .explanations-summary {
    cursor: pointer;
    color: #1e3a8a;
  }

  .explanations[open] .explanations-summary {
    color: #1e40af;
  }

  .explanations .explanation {
    margin: 0.5rem 0 0 1rem;
  }

  .explanations .not-available {
    color: #64748b;
  }

  /* If the explanation is not available, we remove the bold from the answer number to make it less prominent */
  .explanations .explanation.not-available .answer-number {
    font-weight: normal;
  }

  .explanations-non-available-note {
    margin-top: 0.5rem;
  }

  /* NOTE: We don't control the visibility of the original and cloned slides from CSS here because, since the slides are parent elements, we would need to use the :has() pseudo-class, which is not supported in all browsers yet. Instead, we inject global CSS classes "print-only" and "no-print" via JS to the original and cloned slide elements, so that the CSS style is apply from the top and works on all browsers */
  @media print {
    .question-prompt,
    .answer-btn {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .question-image {
      max-height: 12rem;
    }

    .answer-image {
      max-height: 4rem;
    }

    /* Add a check mark so the correct answer remains identifiable in print. */
    .question-container.is-revealed .answer-btn.is-correct::after {
      content: ' ✅';
    }

    /* Hide the disclosure marker in print. */
    .explanations .explanations-summary::marker {
      content: '';
    }
  }
</style>