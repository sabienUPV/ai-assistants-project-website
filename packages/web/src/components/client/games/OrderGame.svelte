<script module lang="ts">
  // Exportamos los tipos en un bloque module separado para que el compilador no se queje
  export interface GameItem {
    id: string | number;
    text: string;
  }
</script>

<script lang="ts">
  import { flip } from 'svelte/animate';
  import { seededShuffle } from '@utils/array';

  // 1. Props usando la runa $props()
  let { 
    correctOrder = [], 
    seed = Math.floor(Math.random() * 1000000) 
  }: { 
    correctOrder: GameItem[], 
    seed?: number 
  } = $props();

  // 2. Estado mutable usando la runa $state()
  // (Nota: Ignoramos el warning de Svelte 5 sobre "state_referenced_locally" porque en este caso es intencional (solo necesitamos el valor inicial de correctOrder, no un binding reactivo a correctOrder como sugiere el warning))
  // svelte-ignore state_referenced_locally
  let currentOrder: GameItem[] = $state(
    correctOrder.length > 0 ? seededShuffle([...correctOrder], seed) : []
  );
  let draggingIndex: number | null = $state(null);

  // 3. Estado derivado con $derived() (Sustituye al bloque $: de Svelte 4)
  // Se recalcula automáticamente cada vez que currentOrder cambia
  let isSuccess = $derived(
    currentOrder.length > 0 && 
    currentOrder.every((item, index) => item.id === correctOrder[index].id)
  );

  // --- LÓGICA DRAG & DROP HTML5 ---
  function handleDragStart(event: DragEvent, index: number) {
    draggingIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString()); 
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault(); // Necesario para permitir el drop
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) return;

    // En Svelte 5, simplemente reasignar el valor dispara la reactividad
    const newList = [...currentOrder];
    const [movedItem] = newList.splice(draggingIndex, 1);
    newList.splice(targetIndex, 0, movedItem);

    currentOrder = newList;
    draggingIndex = null;
  }
</script>

<div class="order-game">
  {#if isSuccess}
    <div class="success-message">
      🎉 ¡Perfecto! Has ordenado los pasos correctamente.
    </div>
  {/if}

  <ul class="drop-zone">
    <!-- IMPORTANTE: El (item.id) es clave para que Svelte sepa qué caja animar con 'flip' -->
    {#each currentOrder as item, index (item.id)}
      <li
        class="draggable-item"
        class:is-dragging={draggingIndex === index}
        class:is-success={isSuccess}
        draggable={!isSuccess} 
        animate:flip={{ duration: 300 }}
        ondragstart={(e) => handleDragStart(e, index)}
        ondragover={(e) => handleDragOver(e, index)}
        ondrop={(e) => handleDrop(e, index)}
      >
        <div class="drag-handle">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </div>
        <span class="text">{item.text}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .order-game {
    max-width: 600px;
    margin: 0 auto;
    font-family: inherit;
  }

  .drop-zone {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .draggable-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--color-background, #ffffff);
    border: 2px solid var(--color-logo-light-blue, #cce0f5);
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    transition: box-shadow 0.2s, border-color 0.2s;
  }

  .draggable-item:active {
    cursor: grabbing;
  }

  .draggable-item.is-dragging {
    opacity: 0.5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--color-primary, #0351a8);
  }

  .draggable-item.is-success {
    cursor: default;
    border-color: #4ade80; 
    background-color: #f0fdf4;
  }

  .drag-handle {
    color: var(--color-logo-dark-grey, #666);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-text, #333);
  }

  .success-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: #dcfce7;
    color: #166534;
    border-radius: 8px;
    font-weight: 700;
    text-align: center;
    border: 1px solid #bbf7d0;
  }
</style>