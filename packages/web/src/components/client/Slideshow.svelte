<script lang="ts">
  import { fade } from 'svelte/transition';

  import type { Slide } from '@sabien-upv-astro-cms/core/src/types/slideshow';

  // En Svelte 5, las propiedades (props) se reciben con $props()
  interface Props {
    slides: Slide[];
    localizedTexts?: {
      prevText?: string;
      nextText?: string;
      prevAriaLabel?: string;
      nextAriaLabel?: string;
    };
  }
  const { slides = [], localizedTexts } : Props = $props();

  // El estado interno para saber en qué diapositiva estamos (Svelte 5 usa $state)
  let currentIndex = $state(0);

  function next() {
    if (currentIndex < slides.length - 1) currentIndex++;
  }

  function prev() {
    if (currentIndex > 0) currentIndex--;
  }
</script>

<div class="slideshow-wrapper">
  <div class="slide-content">
    {#each slides as slide, i}
      {#if i === currentIndex}
        <div in:fade={{ duration: 250 }} class="slide">
          
          {#if slide.title}
            <h2 class="slide-title">{slide.title}</h2>
          {/if}
          
          {#if slide.image}
            <img src={slide.image} alt={slide.alt || 'Image supporting the slide'} class="slide-image" />
          {/if}
          
          {#if slide.text}
            <p class="slide-text">{slide.text}</p>
          {/if}

        </div>
      {/if}
    {/each}
  </div>

  <div class="navigation">
    <button 
      onclick={prev} 
      disabled={currentIndex === 0} 
      class="nav-btn"
      aria-label={localizedTexts?.prevAriaLabel || 'Previous slide'}
    >
      &larr; {localizedTexts?.prevText || 'Previous'}
    </button>

    <div class="counter" aria-live="polite">
      {slides.length > 0 ? currentIndex + 1 : 0} / {slides.length}
    </div>

    <button 
      onclick={next} 
      disabled={currentIndex >= slides.length - 1} 
      class="nav-btn"
      aria-label={localizedTexts?.nextAriaLabel || 'Next slide'}
    >
      {localizedTexts?.nextText || 'Next'} &rarr;
    </button>
  </div>
</div>

<style>
  /* Integrado con tu sistema de diseño y las reglas de accesibilidad */
  .slideshow-wrapper {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    background-color: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    margin: 2rem 0;
    display: flex;
    flex-direction: column;
  }

  .slide-content {
    /* Altura mínima para que los botones de navegación no salten al cambiar de slide */
    min-height: 400px; 
    padding: 2rem;
    position: relative;
    display: grid;
    place-items: center;
  }

  .slide {
    /* La clase grid y placement aseguran que el contenido no salte de forma brusca con las transiciones fade */
    grid-area: 1 / 1; 
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .slide-title {
    font-size: 2rem;
    color: var(--color-secondary); /* Azul oscuro corporativo */
    margin: 0;
  }

  .slide-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    object-fit: contain;
  }

  .slide-text {
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--color-text);
    max-width: 80%;
    margin: 0 auto;
  }

  .navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background-color: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .nav-btn {
    background-color: var(--color-secondary);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s, opacity 0.2s;
    /* Botones grandes para facilitar el clic (Accesibilidad) */
    min-width: 130px;
  }

  .nav-btn:hover:not(:disabled) {
    background-color: var(--color-dark-blue);
  }

  .nav-btn:disabled {
    background-color: var(--color-logo-dark-grey);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .counter {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-logo-dark-grey);
  }
</style>