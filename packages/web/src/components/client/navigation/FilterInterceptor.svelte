<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  function handleInput(event: Event) {
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const params = new URLSearchParams(formData as any);
    
    // Update the URL silently
    window.history.pushState({}, '', `?${params.toString()}`);
    
    // Dispatch a global event so ContentDirectory can react instantly
    window.dispatchEvent(new CustomEvent('filters-updated', { detail: params }));
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    handleInput(event);
  }
</script>

<form 
  onsubmit={handleSubmit} 
  onchange={handleInput} 
  oninput={handleInput}
  class="svelte-interceptor-wrapper"
>
  {@render children?.()}
</form>