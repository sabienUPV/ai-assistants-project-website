<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    fallbackAction?: string; // When JS is disabled or has not yet loaded/hydrated, this action will be used for the form submission as a fallback (for example, go to a "search" page with the selected filters applied)
  }

  let { children, fallbackAction }: Props = $props();

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
    event.preventDefault(); // Prevent standard navigation (this makes sure fallbackAction is not used when JS is enabled and loaded/hydrated)
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
  action={fallbackAction}
  method="GET"
  onsubmit={handleSubmit}
  onchange={handleInput}
  oninput={handleInput}
  onreset={handleReset}
  class="svelte-interceptor-wrapper"
>
  {@render children?.()}
</form>