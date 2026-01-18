/**
 * Card rendering module for Shovo
 */

import { getLargeImage } from './modal.js';

/**
 * Normalize a type label
 * @param {string} typeLabel - Type label
 * @returns {string} - Normalized type label
 */
export function normalizeTypeLabel(typeLabel) {
  return (typeLabel || '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Build Rotten Tomatoes slug
 * @param {string} title - Title
 * @returns {string} - Slug
 */
export function buildRottenTomatoesSlug(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Build Rotten Tomatoes URL
 * @param {object} item - Item
 * @returns {string} - URL
 */
export function buildRottenTomatoesUrl(item) {
  const slug = buildRottenTomatoesSlug(item.title);
  if (!slug) return '';
  const normalizedType = normalizeTypeLabel(item.type_label);
  const basePath = normalizedType === 'tvseries' || normalizedType === 'tvminiseries' ? 'tv' : 'm';
  return `https://www.rottentomatoes.com/${basePath}/${slug}`;
}

/**
 * Build meta text for an item
 * @param {object} item - Item
 * @returns {string} - Meta text
 */
export function buildMetaText(item) {
  const normalizedType = normalizeTypeLabel(item.type_label);
  const labelMap = {
    movie: 'Film',
    tvmovie: 'Film',
    feature: 'Film',
    tvseries: 'Series',
    tvminiseries: 'Mini Series'
  };
  const metaParts = [];
  const displayLabel = labelMap[normalizedType] || (item.type_label || '').toUpperCase();
  if (displayLabel) metaParts.push(displayLabel);
  if (item.original_language) metaParts.push(item.original_language);

  const runtimeMinutes = Number(item.runtime_minutes);
  const avgEpisodeLength = Number(item.avg_episode_length);

  if (normalizedType === 'movie' || normalizedType === 'tvmovie' || normalizedType === 'feature') {
    if (Number.isFinite(runtimeMinutes) && runtimeMinutes > 0) {
      metaParts.push(`${runtimeMinutes} min`);
    }
  }
  if (normalizedType === 'tvseries') {
    if (item.total_seasons) {
      const seasonsLabel = Number(item.total_seasons) === 1 ? 'season' : 'seasons';
      metaParts.push(`${item.total_seasons} ${seasonsLabel}`);
    }
    if (Number.isFinite(avgEpisodeLength) && avgEpisodeLength > 0) {
      metaParts.push(`Avg ${avgEpisodeLength} min`);
    }
  }
  if (normalizedType === 'tvminiseries') {
    if (item.total_episodes) {
      const episodesLabel = Number(item.total_episodes) === 1 ? 'episode' : 'episodes';
      metaParts.push(`${item.total_episodes} ${episodesLabel}`);
    }
    if (Number.isFinite(avgEpisodeLength) && avgEpisodeLength > 0) {
      metaParts.push(`Avg ${avgEpisodeLength} min`);
    }
  }
  return metaParts.join(' . ') || 'Unknown';
}

/**
 * Build rating HTML for an item
 * @param {object} item - Item
 * @returns {string} - HTML string
 */
export function buildRatingHtml(item) {
  const imdbRating = item.rating || 'N/A';
  const normalizedType = normalizeTypeLabel(item.type_label);
  const isSeries = normalizedType === 'tvseries' || normalizedType === 'tvminiseries';
  const rottenRating = item.rotten_tomatoes || 'N/A';
  const imdbUrl = `https://www.imdb.com/title/${item.title_id}/`;
  const searchQuery = encodeURIComponent(
    isSeries ? item.title : item.year ? `${item.title} ${item.year}` : item.title
  );
  const rottenUrl =
    buildRottenTomatoesUrl(item) || `https://www.rottentomatoes.com/search?search=${searchQuery}`;
  return `
    <a class="rating-link" href="${imdbUrl}" target="_blank" rel="noopener noreferrer">
      <span class="rating-badge">
        <img src="/static/imdb-logo.svg" alt="IMDb" loading="lazy" />
        <span>${imdbRating}</span>
      </span>
    </a>
    <a class="rating-link" href="${rottenUrl}" target="_blank" rel="noopener noreferrer">
      <span class="rating-badge">
        <img src="/static/rotten-tomatoes.svg" alt="Rotten Tomatoes" loading="lazy" />
        <span>${rottenRating}</span>
      </span>
    </a>
  `;
}

/**
 * Apply card details to an article element
 * @param {HTMLElement} article - Article element
 * @param {object} item - Item data
 */
export function applyCardDetails(article, item) {
  const meta = article.querySelector('.card-meta');
  const rating = article.querySelector('.card-rating');
  const year = article.querySelector('.card-year');
  
  if (meta) meta.textContent = buildMetaText(item);
  if (rating) rating.innerHTML = buildRatingHtml(item);
  if (year) {
    year.textContent = item.year || '';
    if (!item.year) {
      year.style.display = 'none';
    }
  }
}

/**
 * Check if an item needs details fetched
 * @param {object} item - Item
 * @returns {boolean}
 */
export function needsDetails(item) {
  const hasRating = item.rating !== null && item.rating !== undefined;
  const hasRotten = item.rotten_tomatoes !== null && item.rotten_tomatoes !== undefined;
  const hasRuntime = item.runtime_minutes !== null && item.runtime_minutes !== undefined;
  const hasSeasons = item.total_seasons !== null && item.total_seasons !== undefined;
  const hasEpisodes = item.total_episodes !== null && item.total_episodes !== undefined;
  const hasAvg = item.avg_episode_length !== null && item.avg_episode_length !== undefined;
  const hasLanguage = item.original_language !== null && item.original_language !== undefined;
  return !(hasRating && hasRotten && hasRuntime && hasSeasons && hasEpisodes && hasAvg && hasLanguage);
}

/**
 * Build mobile search result
 * @param {object} item - Item data
 * @param {HTMLTemplateElement} template - Mobile template element
 * @param {Function} onAdd - Add handler function
 * @returns {HTMLElement} - Mobile search result element
 */
export function buildMobileSearchResult(item, template, onAdd) {
  const fragment = template.content.cloneNode(true);
  const button = fragment.querySelector('.mobile-search-result');
  const image = fragment.querySelector('.mobile-search-image');
  const title = fragment.querySelector('.mobile-search-title');
  const year = fragment.querySelector('.mobile-search-year');
  const imdbRating = fragment.querySelector('.mobile-search-imdb');
  const rottenRating = fragment.querySelector('.mobile-search-rotten');

  // Set basic info
  button.dataset.titleId = item.title_id;
  button.dataset.typeLabel = item.type_label || '';
  
  // Set image
  image.src = item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  image.alt = `${item.title} poster`;
  image.loading = 'lazy';

  // Set title and year
  title.textContent = item.title;
  if (item.year) {
    year.textContent = item.year;
  } else {
    year.style.display = 'none';
  }

  // Set ratings if available
  if (item.rating) {
    imdbRating.textContent = item.rating;
  } else {
    imdbRating.style.display = 'none';
  }

  if (item.rotten_tomatoes) {
    rottenRating.textContent = item.rotten_tomatoes;
  } else {
    rottenRating.style.display = 'none';
  }

  // Add click handler to add item when clicked
  if (onAdd) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      onAdd(item, false);
    });
  }

  return button;
}

/**
 * Build a card element from an item
 * @param {object} item - Item data
 * @param {string} mode - Mode ('search' or 'list')
 * @param {HTMLTemplateElement} template - Card template
 * @param {object} handlers - Event handlers
 * @returns {HTMLElement} - Card element
 */
export function buildCard(item, mode, template, handlers) {
  const fragment = template.content.cloneNode(true);
  const article = fragment.querySelector('.card');
  const image = fragment.querySelector('.card-image');
  const title = fragment.querySelector('.card-title-link');
  const addButton = fragment.querySelector('.card-action.primary');
  const watchedButton = fragment.querySelector('.card-action.secondary');
  const moveTopButton = fragment.querySelector('.card-action-top');
  const removeButton = fragment.querySelector('.card-action.danger');
  const dragHandle = fragment.querySelector('.card-drag-handle');

  article.dataset.titleId = item.title_id;
  article.dataset.typeLabel = item.type_label || '';

  // Add lazy loading to images
  image.src = item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  image.alt = `${item.title} poster`;
  image.loading = 'lazy';

  title.textContent = item.title;
  title.href = `https://www.imdb.com/title/${item.title_id}/`;

  if (handlers.onImageClick) {
    image.addEventListener('click', () => {
      handlers.onImageClick(getLargeImage(item.image), `${item.title} poster`);
    });
  }

  applyCardDetails(article, item);

  if (mode === 'search') {
    addButton.textContent = '＋';
    addButton.setAttribute('aria-label', 'Add to watchlist');
    addButton.title = 'Add to watchlist';
    watchedButton.textContent = '✓';
    watchedButton.setAttribute('aria-label', 'Add as watched');
    watchedButton.title = 'Add as watched';
    removeButton.remove();
    dragHandle.remove();
    moveTopButton?.remove();
    if (handlers.onAdd) {
      addButton.addEventListener('click', () => handlers.onAdd(item, false, article));
    }
    if (handlers.onAddWatched) {
      watchedButton.addEventListener('click', () => handlers.onAddWatched(item, true, article));
    }
  } else {
    addButton.classList.add('watched-toggle');
    addButton.textContent = item.watched ? '↺' : '✓';
    addButton.setAttribute('aria-label', item.watched ? 'Move to watchlist' : 'Mark watched');
    addButton.title = item.watched ? 'Move to watchlist' : 'Mark watched';
    watchedButton.remove();
    removeButton.textContent = '✕';
    removeButton.setAttribute('aria-label', 'Remove');
    removeButton.title = 'Remove';
    if (handlers.onToggleWatched) {
      addButton.addEventListener('click', () => handlers.onToggleWatched(item));
    }
    if (handlers.onRemove) {
      removeButton.addEventListener('click', () => handlers.onRemove(item));
    }
    if (handlers.onMoveTop && moveTopButton) {
      moveTopButton.addEventListener('click', () => handlers.onMoveTop(article));
    }
  }

  return article;
}
