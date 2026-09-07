<script lang="ts">
  interface Props {
    message: string;
  }
  
  let { message }: Props = $props();
</script>

<div class="not-in-language-pill" role="status">
  <!-- Inline SVG is the most portable way across Astro and Svelte frameworks -->
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    class="warning-icon" 
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
  <span class="message">
    {message}
  </span>
</div>

<style>
  .not-in-language-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #fffbeb;
    color: #92400e;
    border: 1px solid #f59e0b;
    border-radius: 100vw;
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .warning-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: #d97706;
  }

  .message {
    margin: 0;
    padding: 0;
  }

  @media print {
    .not-in-language-pill {
      display: none;
    }
  }
</style>