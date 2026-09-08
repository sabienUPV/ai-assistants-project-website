<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  function dispatchUpdate(params: URLSearchParams) {
    // Update the browser URL without reloading the page
    window.history.pushState({}, '', `?${params.toString()}`);
    // Dispatch a custom event to notify other components of the filter change
    window.dispatchEvent(new CustomEvent('filters-updated', { detail: params }));
  }

  function handleInput(event: Event) {
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    // Safe transformation from FormData to URLSearchParams
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      params.append(key, value as string);
    }

    dispatchUpdate(params);
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault(); // Prevent standard navigation
    handleInput(event);
  }

  function handleReset(event: Event) {
    // When reset is clicked, we want an empty URL query
    // We use setTimeout to let the native reset clear the form inputs first
    setTimeout(() => {
      dispatchUpdate(new URLSearchParams());
    }, 0);
  }
</script>

<form 
  onsubmit={handleSubmit} 
  onchange={handleInput} 
  oninput={handleInput}
  onreset={handleReset}
  class="svelte-interceptor-wrapper"
>
  {@render children?.()}
</form>

<style>
  /* Hide the submit button if JS is active (auto-filtering is happening) */
  :global(.svelte-interceptor-wrapper button[type="submit"]) {
    display: none;
  }
</style>