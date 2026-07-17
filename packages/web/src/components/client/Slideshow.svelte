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

  let isCurrentSlideLocked = $state(false);

  // Referencia al contenedor HTML
  let container: HTMLElement;

  // Función que lee el DOM para saber si la diapositiva actual está bloqueada
  function checkLockStatus() {
    if (!container || slidesCount === 0) return;
    const slides = container.querySelectorAll('.markdoc-slide');
    const currentSlide = slides[currentIndex] as HTMLElement;
    updateLockStatus(currentSlide);
  }

  function updateLockStatus(currentSlide: HTMLElement | null) {
    // Solo bloqueamos si el atributo existe y es explícitamente "true"
    isCurrentSlideLocked = currentSlide?.dataset.locked === 'true';
  }

  // Escuchamos la petición de viajar a una diapositiva concreta
  const handleGoToSlide = (e: Event) => {
    const customEvent = e as CustomEvent<{ index: number }>;
    currentIndex = customEvent.detail.index; // El effect de debajo debería activarse al cambiar currentIndex y actualizar la visibilidad de las slides
  };

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
        updateLockStatus(el);
      } else {
        el.style.display = 'none';
      }
    });

    // Comprobamos el estado inicial al montar
    checkLockStatus();

    // Añadimos un listener para escuchar los eventos de respuesta del Quiz
    // y actualizar el estado de bloqueo de la diapositiva actual cuando el usuario responde
    container.addEventListener('slidelockchange', checkLockStatus);

    // También escuchamos un evento personalizado para avanzar a la siguiente diapositiva
    // (nos sirve para que la portada del Quiz (QuizCover) pueda avanzar cuando el usuario pulsa "Play")
    container.addEventListener('requestnextslide', next);

    // Escuchamos un evento personalizado para ir a una diapositiva concreta
    // (nos sirve para que el QuizResults pueda volver a la portada del Quiz cuando el usuario pulsa "Jugar otra vez")
    container.addEventListener('gotoslide', handleGoToSlide);
    
    // Limpieza de los listeners al desmontar el componente
    // (muy importante para evitar memory leaks)
    return () => {
      container.removeEventListener('slidelockchange', checkLockStatus);
      container.removeEventListener('requestnextslide', next);
      container.removeEventListener('gotoslide', handleGoToSlide);
    };
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
        disabled={currentIndex >= slidesCount - 1 || isCurrentSlideLocked}
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
    white-space: nowrap;
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
    padding-inline: 1rem;
    white-space: nowrap;
  }

  /* --- RESPONSIVE MOBILE --- */
  @media (max-width: 480px) {
    .navigation {
      flex-direction: column;
      gap: 1rem; /* Añade espacio entre los elementos apilados */
      padding: 1.5rem;
    }

    .nav-btn {
      width: 100%; /* Hace que los botones ocupen todo el ancho */
      min-width: 0; /* Anula el tope de 130px que estaba rompiendo el grid */
    }

    /* Opcional: Forzamos al contador a irse a la primera posición arriba del todo, 
       así los dos botones se quedan juntos abajo. */
    .counter {
      order: -1; 
      padding-inline: 0;
      margin-bottom: 0.5rem;
    }
  }

  @media print {
    .navigation {
      display: none; /* Oculta la navegación al imprimir */
    }

    .slideshow-wrapper {
      border: none; /* Quita el borde al imprimir */
      box-shadow: none; /* Quita la sombra al imprimir */
    }

    .slide-content {
      display: block;
      gap: 0;
    }
  }
</style>