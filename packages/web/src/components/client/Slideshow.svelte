<script lang="ts">
  import type { Snippet } from "svelte";

  // En Svelte 5, las propiedades (props) se reciben con $props()
  interface Props {
    children?: Snippet;
    localizedTexts?: {
      prevText?: string;
      nextText?: string;
      prevAriaLabel?: string;
      nextAriaLabel?: string;
    };
  }
  const { children, localizedTexts } : Props = $props();

  // El estado interno para saber en qué diapositiva estamos (Svelte 5 usa $state)
  let currentIndex = $state(0);
  let slidesCount = $state(0);
  let container: HTMLElement;

  // Se ejecuta cuando el componente se monta en el navegador
  $effect(() => {
    if (!container) return;
    
    // Buscamos todas las diapositivas estáticas generadas por Astro
    const slides = container.querySelectorAll('.markdoc-slide');
    slidesCount = slides.length;

    // Lógica de visibilidad puramente DOM
    slides.forEach((slide, index) => {
      const el = slide as HTMLElement;
      if (index === currentIndex) {
        el.style.display = 'block';
        el.style.animation = 'fadeIn 0.3s ease-in-out';
      } else {
        el.style.display = 'none';
      }
    });
  });

  function next() { if (currentIndex < slidesCount - 1) currentIndex++; }
  function prev() { if (currentIndex > 0) currentIndex--; }
</script>

<div class="slideshow-wrapper">
  <!-- Contenedor estático: Astro vuelca el HTML aquí -->
  <div class="slide-content" bind:this={container}>
    {@render children?.()}
  </div>

  {#if slidesCount > 0}
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
        {slidesCount > 0 ? currentIndex + 1 : 0} / {slidesCount}
      </div>

      <button 
        onclick={next} 
        disabled={currentIndex >= slidesCount - 1} 
        class="nav-btn"
        aria-label={localizedTexts?.nextAriaLabel || 'Next slide'}
      >
        {localizedTexts?.nextText || 'Next'} &rarr;
      </button>
    </div>
  {/if}
</div>

<style>
  /* Animación de entrada para que la transición entre slides HTML no sea tan seca */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

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

    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--color-text);
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