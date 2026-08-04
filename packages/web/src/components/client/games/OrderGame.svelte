<script module lang="ts">
  import type { OrderGameItem } from '@core-types/games';

  // Exportamos los tipos en un bloque module separado para que el compilador no se queje
  export interface GameItem extends OrderGameItem {
    id: string | number;
  }
</script>

<script lang="ts">
  import { flip } from 'svelte/animate';
  import { seededShuffle } from '@utils/array';

  import restartIcon from '@assets/icons/restart.svg?raw';

  // 1. Props usando la runa $props()
  let { 
    correctOrder = [],
    seed,
    localizedTexts
  }: { 
    correctOrder: GameItem[],
    localizedTexts?: {
      successMessage: string;
      playAgainLabel: string;
    },
    seed?: number
  } = $props();

  // 2. Estado mutable usando la runa $state()
  // (Nota: Ignoramos el warning de Svelte 5 sobre "state_referenced_locally" porque en este caso es intencional (solo necesitamos el valor inicial de correctOrder, no un binding reactivo a correctOrder como sugiere el warning))
  // svelte-ignore state_referenced_locally
  let currentOrder: GameItem[] = $state(
    correctOrder.length > 0 ? generateRandomOrder(seed) : []
  );
  let draggingIndex: number | null = $state(null);

  // 3. Estado derivado con $derived()
  let isSuccess = $derived(isOrderSuccess(currentOrder));

  function isOrderSuccess(order: GameItem[]) {
    return order.length > 0 && 
      order.every((item, index) => item.id === correctOrder[index].id);
  }

  // --- LÓGICA DE JUEGO ---
  function generateRandomOrder(seed?: number) {
    // Generamos una semilla nueva para que el barajado sea distinto
    let newOrder;
    let newSeed = seed;
    do {
      //console.log('Generating new seed...');
      // Only generate a new seed if we need to reshuffle (if newOrder has a value, that means we already shuffled earlier and we are reshuffling)
      // or if no initial seed was provided (newSeed is undefined)
      if (newOrder || !newSeed) newSeed = Math.floor(Math.random() * 1000000);
      newOrder = seededShuffle([...correctOrder], newSeed);
    }
    // Si el orden barajado es igual al correcto, generamos una nueva semilla y volvemos a barajar hasta que sea distinto
    while (isOrderSuccess(newOrder));

    // Una vez que tenemos un orden distinto al correcto, lo devolvemos para que quien llame (ya sea al principio o al reiniciar el juego) lo asigne a currentOrder
    return newOrder;
  }

  function restartGame() {
    currentOrder = generateRandomOrder();
    draggingIndex = null;
  }

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
      <p class="success-text">🎉 {localizedTexts?.successMessage || 'Correct! You have ordered the items correctly.'}</p>
      
      <button class="restart-btn" onclick={restartGame}>
        {@html restartIcon}
        {localizedTexts?.playAgainLabel || 'Play Again'}
      </button>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background-color: #dcfce7;
    border-radius: 8px;
    border: 1px solid #bbf7d0;
  }

  .success-text {
    margin: 0;
    color: #166534;
    font-weight: 700;
    font-size: 1.1rem;
    text-align: center;
  }

  .restart-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #166534;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .restart-btn:hover {
    background-color: #14532d;
  }
</style>