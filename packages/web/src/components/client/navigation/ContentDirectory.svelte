<script module lang="ts">
  export interface Translations {
    notInLanguage: string;
    noResults: string;
  }

  export interface SolutionData {
    name: string;
    company: string;
    type: string;
    description: string;
    keywords?: string[];
  }

  export interface SolutionItem {
    id: string;
    data: SolutionData;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import ContentNotInLanguagePill from '@components/client/shared/ContentNotInLanguagePill.svelte';

  interface Props {
    items: SolutionItem[];
    missingIds?: string[];
    readMoreLabel?: string;
    locale: string;
    translations: Translations;
  }

  let { 
    items = [],
    missingIds = [],
    locale,
    readMoreLabel,
    translations
  }: Props = $props();

  // Reactive state using Svelte 5 Runes
  let currentParams = $state(new URLSearchParams());
  let currentPage = $state(1);
  const itemsPerPage = 9;

  // Function to sync state from the actual browser URL
  function syncStateFromURL() {
    if (typeof window !== 'undefined') {
      currentParams = new URLSearchParams(window.location.search);
      const pageParam = currentParams.get('page');
      currentPage = pageParam ? parseInt(pageParam, 10) : 1;
    }
  }

  onMount(() => {
    // Initial sync on load
    syncStateFromURL();

    // Listen to browser Back/Forward navigation
    window.addEventListener('popstate', syncStateFromURL);

    // Listen to our custom event from the FilterInterceptor
    const handleFiltersUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<URLSearchParams>;
      currentParams = customEvent.detail;
      currentPage = 1; // Reset to first page when filtering
    };
    
    window.addEventListener('filters-updated', handleFiltersUpdated);

    // Cleanup listeners on destroy
    return () => {
      window.removeEventListener('popstate', syncStateFromURL);
      window.removeEventListener('filters-updated', handleFiltersUpdated);
    };
  });

  // Derived state: Automatically recalculates when currentParams changes
  let filteredItems = $derived.by(() => {
    const query = currentParams.get('q')?.toLowerCase() || '';
    const keywords = currentParams.getAll('keyword');

    return items.filter(item => {
      const matchesQuery = query 
        ? item.data.name.toLowerCase().includes(query) || item.data.description.toLowerCase().includes(query)
        : true;
      
      const matchesKeyword = keywords.length > 0
        ? item.data.keywords?.some(k => keywords.includes(k.toLowerCase()))
        : true;
      
      return matchesQuery && matchesKeyword;
    });
  });

  // Derived state: Applies pagination to the filtered results
  let paginatedItems = $derived(
    filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  );

  // Helper to generate the correct URL just like in Astro
  function getSlugFromEntryId(id: string) {
    return id.split('/').pop()?.replace(/\.[^/.]+$/, "") || id;
  }
</script>

<div class="posts-grid">
  {#if paginatedItems.length === 0}
    <div class="no-results">{translations.noResults}</div>
  {/if}

  {#each paginatedItems as solution (solution.id)}
    {@const solutionUrl = `/${locale}/ai-solutions/${getSlugFromEntryId(solution.id)}`}
    
    <article class="post-card">
      <div class="card-body">
        {#if missingIds.includes(solution.id)}
          <div class="not-in-language-pill-container">
            <ContentNotInLanguagePill message={translations.notInLanguage} />
          </div>
        {/if}

        <h2 class="card-title">
          <a href={solutionUrl}>{solution.data.name}</a>
        </h2>
        <div class="card-meta">
          {solution.data.company} • {solution.data.type}
        </div>
        <p class="card-excerpt">
          {solution.data.description}
        </p>
      </div>
      <a href={solutionUrl} class="read-more-btn">
        {readMoreLabel || 'Read more'} &rarr;
      </a>
      <div class="card-keywords">
        {#if solution.data.keywords}
          {#each solution.data.keywords as keyword}
            <span class="keyword">{keyword}</span>
          {/each}
        {/if}
      </div>
    </article>
  {/each}
</div>

<style>
  /* Reusing your blog directory styles for consistency */
  .posts-grid {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
  .post-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    padding-top: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background-color: #fff;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .post-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .card-body {
    display: flex;
    flex-direction: column;
  }
  .card-keywords {
    margin-top: 1rem;
  }
  .card-keywords .keyword {
    display: inline-block;
    background-color: var(--color-logo-light-grey);
    color: var(--color-logo-dark-grey);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    padding-left: 0;
    border-radius: 4px;
    margin-right: 0.3rem;
    margin-bottom: 0.3rem;
  }
  .card-title {
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1.3;
    text-align: left;
    margin: 0 0 0.5rem 0;
    padding-top: 0.5rem;
  }
  .card-title a {
    color: var(--color-secondary);
    text-decoration: none;
  }
  .card-title a:hover {
    color: var(--color-link-hover);
    text-decoration: underline;
  }
  .card-meta {
    font-size: 0.85rem;
    color: var(--color-logo-dark-grey);
    margin-bottom: 1rem;
  }
  .card-excerpt {
    color: var(--color-text);
    font-size: 0.95rem;
    margin: 0 0 1.5rem 0;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .read-more-btn {
    align-self: flex-start;
    color: var(--color-link);
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
    margin-top: auto;
  }
  .read-more-btn:hover {
    text-decoration: underline;
    color: var(--color-link-hover);
  }
</style>