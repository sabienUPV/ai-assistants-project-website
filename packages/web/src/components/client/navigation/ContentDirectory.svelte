<script module lang="ts">
  export interface DirectoryItem {
    id: string;
    url: string;
    title: string;
    subtitle?: string;
    excerpt?: string;
    keywords?: string[];
    isMissingTranslation?: boolean;
    // We keep the raw data so the search function can access it
    rawData: any;
  }

  // Pure JSON serializable configuration
  export interface FilterConfig {
    searchFields?: string[]; // Keys in rawData to apply text search (e.g. ['name', 'description'])
    arrayFilters?: { paramName: string; dataKey: string }[]; // For arrays like thematicArea
    exactFilters?: { paramName: string; dataKey: string }[]; // For exact matches like type
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import ContentNotInLanguagePill from '@components/client/shared/ContentNotInLanguagePill.svelte';
  import { getUrlFriendlyVersionOfString } from '@utils/url';

  interface Props {
    items: DirectoryItem[];
    filterConfig?: FilterConfig;
    readMoreLabel?: string;
    translations: {
      notInLanguage: string;
      noResults: string;
    };
  }

  let { 
    items = [],
    filterConfig,
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
      currentParams = (e as CustomEvent<URLSearchParams>).detail;
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
  // Generic Filter Engine
  let filteredItems = $derived.by(() => {
    const query = currentParams.get('q')?.toLowerCase() || '';

    return items.filter(item => {
      if (!filterConfig) return true; // If no config, return everything
      
      const data = item.rawData;

      // 1. Text Search
      if (query && filterConfig.searchFields?.length) {
        const matchesQuery = filterConfig.searchFields.some(field => 
          String(data[field] || '').toLowerCase().includes(query)
        );
        if (!matchesQuery) return false;
      }

      // 2. Array Intersect Filters (e.g. thematic areas)
      if (filterConfig.arrayFilters) {
        for (const filter of filterConfig.arrayFilters) {
          const selectedValues = currentParams.getAll(getUrlFriendlyVersionOfString(filter.paramName));
          if (selectedValues.length > 0) {
            const rawItemValue = data[filter.dataKey];
            const itemValues = Array.isArray(rawItemValue)
              ? rawItemValue.map(v => getUrlFriendlyVersionOfString(String(v || '')))
              : [getUrlFriendlyVersionOfString(String(rawItemValue || ''))];
            const matches = itemValues.some((v: string) => selectedValues.includes(v));
            if (!matches) return false;
          }
        }
      }

      // 3. Exact Match Filters (e.g. solution type)
      if (filterConfig.exactFilters) {
        for (const filter of filterConfig.exactFilters) {
          const selectedValues = currentParams.getAll(getUrlFriendlyVersionOfString(filter.paramName));
          if (selectedValues.length > 0) {
            const rawItemValue = data[filter.dataKey];
            const itemValue = getUrlFriendlyVersionOfString(String(rawItemValue || ''));
            if (!selectedValues.includes(itemValue)) return false;
          }
        }
      }

      return true;
    });
  });

  // Derived state: Applies pagination to the filtered results
  let paginatedItems = $derived(
    filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  );
</script>

<div class="posts-grid">
  {#if paginatedItems.length === 0}
    <div class="no-results">{translations.noResults}</div>
  {/if}

  {#each paginatedItems as item (item.id)}
    <article class="post-card">
      <div class="card-body">
        {#if item.isMissingTranslation}
          <div class="not-in-language-pill-container">
            <ContentNotInLanguagePill message={translations.notInLanguage} />
          </div>
        {/if}

        <h2 class="card-title">
          <a href={item.url}>{item.title}</a>
        </h2>
        
        {#if item.subtitle}
          <div class="card-subtitle">{item.subtitle}</div>
        {/if}
        
        {#if item.excerpt}
          <p class="card-excerpt">{item.excerpt}</p>
        {/if}
      </div>
      <a href={item.url} class="read-more-btn">
        {readMoreLabel || 'Read more'} &rarr;
      </a>
      <div class="card-keywords">
        {#if item.keywords}
          {#each item.keywords as keyword}
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
  .card-subtitle {
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