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
      numberInputLabel?: string;
    };
  }
  const { children, localizedTexts } : Props = $props();

  // El estado interno para saber en qué diapositiva estamos (Svelte 5 usa $state)
  let currentIndex = $state(0);
  let slidesCount = $state(0);

  let isCurrentSlideLocked = $state(false);

  // Referencia al contenedor HTML
  let container: HTMLElement;

  // Flag para no volver a leer la URL en cada recálculo del $effect
  let isUrlInitialized = false; 

  // Función centralizada para cambiar de diapositiva de forma segura
  function jumpToSlide(index: number, updateUrl: boolean = true) {
    if (slidesCount === 0) return;
    
    // Clamp entre 0 y slidesCount - 1
    currentIndex = Math.max(0, Math.min(index, slidesCount - 1));

    // Actualizamos la URL silenciosamente (usamos índice basado en 1 para que la URL sea más humana, ej: ?slide=2)
    if (updateUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('slide', (currentIndex + 1).toString());
      // replaceState no llena el historial, así no rompemos el botón de "Atrás" del navegador
      window.history.replaceState(null, '', url);
    }
  }

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
    jumpToSlide(customEvent.detail.index); // El effect de debajo debería activarse al cambiar currentIndex y actualizar la visibilidad de las slides
  };

  // Manejador para el input numérico manual
  const handleManualInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const parsed = parseInt(target.value, 10);
    
    if (!isNaN(parsed)) {
      jumpToSlide(parsed - 1); // Restamos 1 porque el usuario inserta un número [1..n] y currentIndex es [0..n-1]
    }
    
    // Forzamos que el input se actualice visualmente si el usuario intentó poner un número fuera de los límites
    target.value = (currentIndex + 1).toString();
  };

  // Se ejecuta cuando el componente se monta en el navegador
  $effect(() => {
    if (!container) return;
    
    // Buscamos todas las diapositivas estáticas generadas por Astro
    const slides = container.querySelectorAll('.markdoc-slide');
    slidesCount = slides.length;

    // Leemos la URL solo la primera vez que se monta el componente
    if (!isUrlInitialized) {
      const params = new URLSearchParams(window.location.search);
      const slideParam = params.get('slide');
      if (slideParam) {
        const parsed = parseInt(slideParam, 10);
        if (!isNaN(parsed)) {
          // Restamos 1 porque el usuario inserta un número [1..n] y currentIndex es [0..n-1]
          // Pasamos updateUrl=false para no hacer un replaceState redundante en la carga inicial
          jumpToSlide(parsed - 1, false);
        }
      }
      isUrlInitialized = true;
    }

    // Lógica de visibilidad puramente DOM
    slides.forEach((slide, index) => {
      const el = slide as HTMLElement;
      if (index === currentIndex) {
        el.classList.add('slide-visible');
        el.classList.remove('slide-hidden');
        updateLockStatus(el);
      } else {
        el.classList.add('slide-hidden');
        el.classList.remove('slide-visible');
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

  function next() { jumpToSlide(currentIndex + 1); }
  function prev() { jumpToSlide(currentIndex - 1); }
</script>

<div class="slideshow-wrapper">
  <!-- Contenedor estático: Astro vuelca el HTML aquí -->
  <div class="slideshow-content" bind:this={container}>
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
        <input 
          type="number" 
          class="slide-input" 
          value={currentIndex + 1} 
          min="1" 
          max={slidesCount} 
          onchange={handleManualInput}
          aria-label={localizedTexts?.numberInputLabel || 'Jump to slide number'}
        /> 
        / {slidesCount}
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

  /* NOTE: We are using CSS classes instead of injecting inline styles so that child components can override them
  (e.g., Question.svelte needs to show hidden slides in print, so if we had inline styles, those would override the child's styles and keep them hidden) */
  /* Note 2: The :global keyword here tells Svelte to trust us that .slide-hidden and .slide-visible will be there even if it can't notice because we are injecting that class via JS */
  /* Reference: https://svelte.dev/docs/svelte/compiler-warnings#css_unused_selector */
  @media screen {
    :global(.slide-hidden) {
      display: none;
    }
    :global(.slide-visible) {
      display: block;
      animation: fadeIn 0.3s ease-in-out;
    }
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

  .slideshow-content {
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-logo-dark-grey);
    padding-inline: 1rem;
    white-space: nowrap;
  }

  /* Estilos para que el input parezca texto normal hasta que interactúas con él */
  .slide-input {
    font-family: inherit;
    width: 4ch;
    text-align: right;
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-logo-dark-grey);
    background-color: transparent;
    border: 2px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.2rem;
    transition: all 0.2s ease;
  }

  .slide-input:hover, .slide-input:focus {
    
    background-color: white;
    outline: none;
  }

  /* --- RESPONSIVE MOBILE --- */
  @media (max-width: 550px) {
    .slideshow-content {
      padding: 1rem;
    }

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

    .slideshow-content {
      display: block;
      gap: 0;
    }
  }
</style>