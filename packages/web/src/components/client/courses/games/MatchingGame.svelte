<script module lang="ts">
  import type { MatchingGamePair } from '@core-types/games';

  export interface MatchPair extends MatchingGamePair {
    id: string | number;
  }
</script>

<script lang="ts">
  import { seededShuffle } from '@utils/array';
  import restartIcon from '@assets/icons/restart.svg?raw';

  let {
    pairs = [],
    seed = Math.floor(Math.random() * 1000000),
    localizedTexts
  }: {
    pairs: MatchPair[],
    localizedTexts?: {
      successMessage?: string;
      playAgainLabel?: string;
    },
    seed?: number
  } = $props();

  // La columna izquierda se queda fija, la derecha se baraja
  // svelte-ignore state_referenced_locally
  let leftColumn = $state([...pairs]);
  
  // svelte-ignore state_referenced_locally
  let rightColumn = $state(
    pairs.length > 0 ? seededShuffle([...pairs], seed) : []
  );

  // Estado del juego
  let selectedLeft: MatchPair['id'] | null = $state(null);
  let selectedRight: MatchPair['id'] | null = $state(null);
  let matchedIds: MatchPair['id'][] = $state([]);
  let isError: boolean = $state(false);

  // Condición de victoria
  let isSuccess = $derived(
    matchedIds.length === pairs.length && pairs.length > 0
  );

  // Manejadores de clics
  function handleLeftClick(id: MatchPair['id']) {
    if (matchedIds.includes(id) || isError) return;
    // Si tocas el mismo, se deselecciona
    selectedLeft = selectedLeft === id ? null : id;
    checkMatch();
  }

  function handleRightClick(id: MatchPair['id']) {
    if (matchedIds.includes(id) || isError) return;
    selectedRight = selectedRight === id ? null : id;
    checkMatch();
  }

  function checkMatch() {
    if (selectedLeft && selectedRight) {
      if (selectedLeft === selectedRight) {
        // ¡Acierto!
        matchedIds = [...matchedIds, selectedLeft];
        selectedLeft = null;
        selectedRight = null;
      } else {
        // Fallo: mostramos error y reseteamos tras un breve delay
        isError = true;
        setTimeout(() => {
          selectedLeft = null;
          selectedRight = null;
          isError = false;
        }, 800);
      }
    }
  }

  function restartGame() {
    const newSeed = Math.floor(Math.random() * 1000000);
    rightColumn = seededShuffle([...pairs], newSeed);
    matchedIds = [];
    selectedLeft = null;
    selectedRight = null;
    isError = false;
  }
</script>

<div class="matching-game">
  {#if isSuccess}
    <div class="success-message">
      <p class="success-text">🎉 {localizedTexts?.successMessage || '¡Genial! Has emparejado todo correctamente.'}</p>
      
      <button class="restart-btn" onclick={restartGame}>
        {@html restartIcon}
        {localizedTexts?.playAgainLabel || 'Jugar de nuevo'}
      </button>
    </div>
  {/if}

  <div class="columns-container">
    <!-- COLUMNA IZQUIERDA (Pasos) -->
    <div class="column left-column">
      {#each leftColumn as item (item.id)}
        <button 
          class="match-card"
          class:is-selected={selectedLeft === item.id}
          class:is-matched={matchedIds.includes(item.id)}
          class:is-error={isError && selectedLeft === item.id}
          disabled={matchedIds.includes(item.id)}
          onclick={() => handleLeftClick(item.id)}
          aria-label={item.leftText}
        >
          <div class="card-content">
            {#if item.leftImage}
              <img src={item.leftImage} alt="" class="card-image" />
            {:else}
              <div class="placeholder-img"></div>
            {/if}
            <span class="text">{item.leftText}</span>
          </div>
          <!-- Círculo conector -->
          <div class="node right-node"></div>
        </button>
      {/each}
    </div>

    <!-- COLUMNA DERECHA (Herramientas) -->
    <div class="column right-column">
      {#each rightColumn as item (item.id)}
        <button 
          class="match-card right-card"
          class:is-selected={selectedRight === item.id}
          class:is-matched={matchedIds.includes(item.id)}
          class:is-error={isError && selectedRight === item.id}
          disabled={matchedIds.includes(item.id)}
          onclick={() => handleRightClick(item.id)}
          aria-label={item.rightText}
        >
          <!-- Círculo conector -->
          <div class="node left-node"></div>
          
          <div class="card-content">
            {#if item.rightImage}
              <img src={item.rightImage} alt="" class="card-image" />
            {:else}
              <div class="placeholder-img"></div>
            {/if}
            <span class="text">{item.rightText}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .matching-game {
    max-width: 800px;
    margin: 0 auto;
    font-family: inherit;
  }

  .columns-container {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    position: relative;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    flex: 1;
  }

  .match-card {
    position: relative;
    display: flex;
    align-items: center;
    background: #ffffff;
    border: 3px solid #cbd5e1;
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    width: 100%;
    min-height: 100px;
  }

  .match-card:hover:not(:disabled) {
    border-color: #94a3b8;
    transform: translateY(-2px);
  }

  .card-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    width: 100%;
  }

  .card-image {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }

  .placeholder-img {
    width: 60px;
    height: 60px;
    background-color: #f1f5f9;
    border-radius: 4px;
  }

  .text {
    font-size: 1.2rem;
    font-weight: 500;
    color: #334155;
    flex: 1;
  }

  /* Nodos conectores imitando el diseño visual */
  .node {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background-color: #3b82f6;
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .right-node {
    right: -12px;
  }

  .left-node {
    left: -12px;
  }

  /* ESTADOS (Seleccionado, Acierto, Error) */
  .match-card.is-selected {
    border-color: #3b82f6;
    background-color: #eff6ff;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }

  .match-card.is-matched {
    border-color: #22c55e;
    background-color: #f0fdf4;
    cursor: default;
    opacity: 0.8;
  }
  .match-card.is-matched .node {
    background-color: #22c55e;
  }

  .match-card.is-error {
    border-color: #ef4444;
    background-color: #fef2f2;
  }
  .match-card.is-error .node {
    background-color: #ef4444;
  }

  @media (prefers-reduced-motion: no-preference) {
    .match-card.is-error {
      animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      75% { transform: translateX(-5px); }
    }
  }

  /* Mensaje de éxito (heredado del OrderGame) */
  .success-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
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