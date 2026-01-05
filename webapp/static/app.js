const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const searchModal = document.getElementById('search-modal');
const trendingResults = document.getElementById('trending-results');
const trendingPopover = document.getElementById('trending-popover');
const listResults = document.getElementById('list-results');
const tabWatchlist = document.getElementById('tab-watchlist');
const tabWatched = document.getElementById('tab-watched');
const cardTemplate = document.getElementById('result-card-template');
const changeListButton = document.getElementById('change-list-id');
const trendingButton = document.getElementById('trending-button');
const refreshDatabaseButton = document.getElementById('refresh-database');
const menu = document.querySelector('.menu');
const roomTagButton = document.getElementById('room-tag-button');
const renameModal = document.getElementById('rename-modal');
const renameModalInput = document.getElementById('rename-modal-input');
const renameModalCancel = document.getElementById('rename-modal-cancel');
const renameModalConfirm = document.getElementById('rename-modal-confirm');
const renameModalClose = document.getElementById('rename-modal-close');
const refreshConfirmModal = document.getElementById('refresh-confirm-modal');
const refreshConfirmCancel = document.getElementById('refresh-confirm-cancel');
const refreshConfirmStart = document.getElementById('refresh-confirm-start');
const refreshConfirmClose = document.getElementById('refresh-confirm-close');
const refreshProgressModal = document.getElementById('refresh-progress-modal');
const refreshProgressClose = document.getElementById('refresh-progress-close');
const refreshProgressTitle = document.getElementById('refresh-progress-title');
const refreshProgressBar = document.getElementById('refresh-progress-bar');
const refreshProgressText = document.getElementById('refresh-progress-text');
const imageModal = document.getElementById('image-modal');
const imageModalClose = document.getElementById('image-modal-close');
const imageModalImage = document.getElementById('image-modal-image');
const listPagination = document.getElementById('list-pagination');
const listPrev = document.getElementById('list-prev');
const listNext = document.getElementById('list-next');
const listPageStatus = document.getElementById('list-page-status');

const MAX_RESULTS = 10;
const PAGE_SIZE = 10;
let activeTab = 'unwatched';
let searchTimer;
let activeSearchController;
let lastSearchQuery = '';
let lastSearchResults = [];
let draggingCard = null;
let draggingPointerId = null;
let draggingStartY = 0;
let draggingOffsetY = 0;
let activeDragHandle = null;
let dragPlaceholder = null;
let dragOriginRect = null;
const pageState = { unwatched: 1, watched: 1 };
const totalPages = { unwatched: 1, watched: 1 };
const pendingDetailRequests = new Set();
const detailCache = new Map();
let refreshPollingTimer;
let refreshOwner = false;

const showStatus = (container, message) => {
  container.innerHTML = `<p class="card-meta">${message}</p>`;
};

const getLargeImage = (url) => {
  if (!url) {
    return 'https://via.placeholder.com/500x750?text=No+Image';
  }
  if (url.includes('._V1_')) {
    return url.replace(/_UX\d+_CR0,0,\d+,\d+_AL_/i, '_UX500_CR0,0,500,750_AL_');
  }
  return url;
};

const openImageModal = (src, alt) => {
  if (!imageModal || !imageModalImage) {
    return;
  }
  imageModalImage.src = src;
  imageModalImage.alt = alt;
  imageModal.classList.add('is-visible');
  imageModal.setAttribute('aria-hidden', 'false');
};

const closeImageModal = () => {
  if (!imageModal) {
    return;
  }
  imageModal.classList.remove('is-visible');
  imageModal.setAttribute('aria-hidden', 'true');
  if (imageModalImage) {
    imageModalImage.src = '';
  }
};

const openSearchModal = () => {
  if (!searchModal) {
    return;
  }
  closeTrendingPopover();
  searchModal.classList.add('is-visible');
  searchModal.setAttribute('aria-hidden', 'false');
};

const closeSearchModal = () => {
  if (!searchModal) {
    return;
  }
  searchModal.classList.remove('is-visible');
  searchModal.setAttribute('aria-hidden', 'true');
};

const openRefreshConfirmModal = () => {
  if (!refreshConfirmModal) {
    return;
  }
  refreshConfirmModal.classList.add('is-visible');
  refreshConfirmModal.setAttribute('aria-hidden', 'false');
};

const closeRefreshConfirmModal = () => {
  if (!refreshConfirmModal) {
    return;
  }
  refreshConfirmModal.classList.remove('is-visible');
  refreshConfirmModal.setAttribute('aria-hidden', 'true');
};

const openRefreshProgressModal = () => {
  if (!refreshProgressModal) {
    return;
  }
  refreshProgressModal.classList.add('is-visible');
  refreshProgressModal.setAttribute('aria-hidden', 'false');
};

const closeRefreshProgressModal = () => {
  if (!refreshProgressModal) {
    return;
  }
  refreshProgressModal.classList.remove('is-visible');
  refreshProgressModal.setAttribute('aria-hidden', 'true');
};

const openTrendingPopover = () => {
  if (!trendingPopover) {
    return;
  }
  trendingPopover.classList.add('is-visible');
  trendingPopover.setAttribute('aria-hidden', 'false');
};

const closeTrendingPopover = () => {
  if (!trendingPopover) {
    return;
  }
  trendingPopover.classList.remove('is-visible');
  trendingPopover.setAttribute('aria-hidden', 'true');
};

const sanitizeRoom = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

const normalizeTypeLabel = (typeLabel) =>
  (typeLabel || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const buildRottenTomatoesSlug = (title) =>
  (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildRottenTomatoesUrl = (item) => {
  const slug = buildRottenTomatoesSlug(item.title);
  if (!slug) {
    return '';
  }
  const normalizedType = normalizeTypeLabel(item.type_label);
  const basePath = normalizedType === 'tvseries' || normalizedType === 'tvminiseries' ? 'tv' : 'm';
  return `https://www.rottentomatoes.com/${basePath}/${slug}`;
};

const buildMetaText = (item) => {
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
  if (displayLabel) {
    metaParts.push(displayLabel);
  }
  if (item.year) {
    metaParts.push(item.year);
  }
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
};

const buildRatingHtml = (item) => {
  const imdbRating = item.rating || 'N/A';
  const normalizedType = normalizeTypeLabel(item.type_label);
  const isSeries = normalizedType === 'tvseries' || normalizedType === 'tvminiseries';
  const rottenRating = item.rotten_tomatoes || (isSeries ? 'Search' : 'N/A');
  const imdbUrl = `https://www.imdb.com/title/${item.title_id}/`;
  const searchQuery = encodeURIComponent(
    isSeries ? item.title : item.year ? `${item.title} ${item.year}` : item.title
  );
  const rottenUrl = buildRottenTomatoesUrl(item) || `https://www.rottentomatoes.com/search?search=${searchQuery}`;
  return `
    <a class="rating-link" href="${imdbUrl}" target="_blank" rel="noopener noreferrer">
      <span class="rating-badge">
        <img src="/static/imdb-logo.svg" alt="IMDb" />
        <span>${imdbRating}</span>
      </span>
    </a>
    <a class="rating-link" href="${rottenUrl}" target="_blank" rel="noopener noreferrer">
      <span class="rating-badge">
        <img src="/static/rotten-tomatoes.svg" alt="Rotten Tomatoes" />
        <span>${rottenRating}</span>
      </span>
    </a>
  `;
};

const applyCardDetails = (article, item) => {
  const meta = article.querySelector('.card-meta');
  const rating = article.querySelector('.card-rating');
  if (meta) {
    meta.textContent = buildMetaText(item);
  }
  if (rating) {
    rating.innerHTML = buildRatingHtml(item);
  }
};

const buildCard = (item, mode) => {
  const fragment = cardTemplate.content.cloneNode(true);
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
  image.src = item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  image.alt = `${item.title} poster`;
  title.textContent = item.title;
  title.href = `https://www.imdb.com/title/${item.title_id}/`;
  image.addEventListener('click', () => {
    openImageModal(getLargeImage(item.image), `${item.title} poster`);
  });
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
    addButton.addEventListener('click', () => addToList(item, false, article));
    watchedButton.addEventListener('click', () => addToList(item, true, article));
  } else {
    addButton.textContent = item.watched ? '↺' : '✓';
    addButton.setAttribute(
      'aria-label',
      item.watched ? 'Move to watchlist' : 'Mark watched'
    );
    addButton.title = item.watched ? 'Move to watchlist' : 'Mark watched';
    watchedButton.remove();
    removeButton.textContent = '✕';
    removeButton.setAttribute('aria-label', 'Remove');
    removeButton.title = 'Remove';
    addButton.addEventListener('click', () => toggleWatched(item));
    removeButton.addEventListener('click', () => removeFromList(item));
    moveTopButton?.addEventListener('click', () => moveItemToTop(article));
  }

  return article;
};

const needsDetails = (item) => {
  const hasRating = item.rating !== null && item.rating !== undefined;
  const hasRotten = item.rotten_tomatoes !== null && item.rotten_tomatoes !== undefined;
  const hasRuntime = item.runtime_minutes !== null && item.runtime_minutes !== undefined;
  const hasSeasons = item.total_seasons !== null && item.total_seasons !== undefined;
  const hasEpisodes = item.total_episodes !== null && item.total_episodes !== undefined;
  const hasAvg = item.avg_episode_length !== null && item.avg_episode_length !== undefined;
  return !(hasRating && hasRotten && hasRuntime && hasSeasons && hasEpisodes && hasAvg);
};

const requestDetails = async (item, article) => {
  if (!needsDetails(item) || pendingDetailRequests.has(item.title_id)) {
    return;
  }
  if (detailCache.has(item.title_id)) {
    applyCardDetails(article, { ...item, ...detailCache.get(item.title_id) });
    return;
  }
  pendingDetailRequests.add(item.title_id);
  try {
    const response = await fetch(
      `/api/details?title_id=${encodeURIComponent(item.title_id)}&type_label=${encodeURIComponent(
        item.type_label || ''
      )}`
    );
    if (!response.ok) {
      return;
    }
    const details = await response.json();
    detailCache.set(item.title_id, details);
    const updated = { ...item, ...details };
    if (article.isConnected) {
      applyCardDetails(article, updated);
    }
  } catch (error) {
    // no-op
  } finally {
    pendingDetailRequests.delete(item.title_id);
  }
};

const updateRefreshProgress = (state) => {
  if (!refreshProgressBar || !refreshProgressText || !refreshProgressTitle) {
    return;
  }
  const total = Number(state.total || 0);
  const processed = Number(state.processed || 0);
  const percent = total ? Math.round((processed / total) * 100) : 0;
  refreshProgressBar.max = 100;
  refreshProgressBar.value = percent;
  refreshProgressText.textContent = total
    ? `${processed} of ${total} items refreshed`
    : 'Preparing refresh…';
  if (!state.refreshing) {
    refreshProgressTitle.textContent = 'Refresh complete';
    refreshProgressText.textContent = total
      ? `${processed} of ${total} items refreshed`
      : 'Refresh completed.';
  } else {
    refreshProgressTitle.textContent = refreshOwner
      ? 'Refreshing database…'
      : 'Database refresh in progress…';
  }
};

const stopRefreshPolling = () => {
  if (refreshPollingTimer) {
    clearInterval(refreshPollingTimer);
    refreshPollingTimer = null;
  }
};

const pollRefreshStatus = async () => {
  try {
    const response = await fetch(`/api/refresh/status?room=${encodeURIComponent(room)}`);
    if (!response.ok) {
      return;
    }
    const state = await response.json();
    if (state.refreshing) {
      openRefreshProgressModal();
      updateRefreshProgress(state);
      if (!refreshPollingTimer) {
        startRefreshPolling();
      }
    } else if (refreshProgressModal?.classList.contains('is-visible')) {
      updateRefreshProgress(state);
      setTimeout(closeRefreshProgressModal, 800);
      refreshOwner = false;
      stopRefreshPolling();
    } else {
      stopRefreshPolling();
    }
  } catch (error) {
    // no-op
  }
};

const startRefreshPolling = () => {
  if (!refreshPollingTimer) {
    refreshPollingTimer = setInterval(pollRefreshStatus, 3000);
  }
};

const renderSearchResults = (items) => {
  searchResults.innerHTML = '';
  const limited = items.slice(0, MAX_RESULTS);
  if (!limited.length) {
    return;
  }
  openSearchModal();
  limited.forEach((item) => {
    const card = buildCard(item, 'search');
    searchResults.appendChild(card);
    requestDetails(item, card);
  });
};

const renderTrendingResults = (items) => {
  trendingResults.innerHTML = '';
  const limited = items.slice(0, MAX_RESULTS);
  if (!limited.length) {
    return;
  }
  openTrendingPopover();
  limited.forEach((item) => {
    const card = buildCard(item, 'search');
    trendingResults.appendChild(card);
    requestDetails(item, card);
  });
};

const renderList = (items) => {
  listResults.innerHTML = '';
  if (!items.length) {
    showStatus(
      listResults,
      activeTab === 'watched'
        ? 'No watched items yet.'
        : 'Your list is empty. Add something from the search results.'
    );
    return;
  }
  items.forEach((item) => {
    const card = buildCard(item, 'list');
    listResults.appendChild(card);
    requestDetails(item, card);
  });
  attachDragHandlers();
};

const filterCachedResults = (query) => {
  const normalized = query.toLowerCase();
  return lastSearchResults.filter((item) =>
    item.title.toLowerCase().includes(normalized)
  );
};

const fetchSearch = async () => {
  const query = searchInput.value.trim();
  if (query.length < 3) {
    renderSearchResults([]);
    lastSearchQuery = '';
    lastSearchResults = [];
    closeSearchModal();
    if (activeSearchController) {
      activeSearchController.abort();
      activeSearchController = null;
    }
    return;
  }
  if (query.length >= 3 && lastSearchQuery && query.startsWith(lastSearchQuery)) {
    const cached = filterCachedResults(query);
    if (cached.length) {
      renderSearchResults(cached);
    } else {
      openSearchModal();
      showStatus(searchResults, 'Searching...');
    }
  } else {
    openSearchModal();
    showStatus(searchResults, 'Searching...');
  }
  if (activeSearchController) {
    activeSearchController.abort();
  }
  activeSearchController = new AbortController();
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: activeSearchController.signal
    });
    if (!response.ok) {
      openSearchModal();
      showStatus(searchResults, 'Search failed. Try again later.');
      return;
    }
    const data = await response.json();
    lastSearchQuery = query;
    lastSearchResults = data.results || [];
    if (!lastSearchResults.length) {
      openSearchModal();
      showStatus(searchResults, 'No matches found.');
      return;
    }
    renderSearchResults(lastSearchResults);
  } catch (error) {
    if (error.name !== 'AbortError') {
      openSearchModal();
      showStatus(searchResults, 'Search failed. Try again later.');
    }
  }
};

const debounceSearch = () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (query.length >= 3 && lastSearchQuery && query.startsWith(lastSearchQuery)) {
    renderSearchResults(filterCachedResults(query));
  }
  if (!query) {
    renderSearchResults([]);
    closeSearchModal();
    return;
  }
  searchTimer = setTimeout(fetchSearch, 250);
};

const loadList = async () => {
  showStatus(listResults, 'Loading list...');
  const page = pageState[activeTab];
  const response = await fetch(
    `/api/list?room=${encodeURIComponent(room)}&status=${activeTab}&page=${page}&per_page=${PAGE_SIZE}`
  );
  if (!response.ok) {
    showStatus(listResults, 'Unable to load list.');
    return;
  }
  const data = await response.json();
  if (!data.items?.length && page > 1) {
    pageState[activeTab] = page - 1;
    await loadList();
    return;
  }
  totalPages[activeTab] = data.total_pages || 1;
  renderList(data.items || []);
  if (listPageStatus) {
    listPageStatus.textContent = `Page ${pageState[activeTab]} of ${totalPages[activeTab]}`;
  }
  if (listPrev) {
    listPrev.disabled = pageState[activeTab] <= 1;
  }
  if (listNext) {
    listNext.disabled = pageState[activeTab] >= totalPages[activeTab];
  }
  if (listPagination) {
    listPagination.style.display = totalPages[activeTab] > 1 ? 'flex' : 'none';
  }
  pollRefreshStatus();
};

const fetchTrending = async () => {
  if (!trendingResults) {
    return;
  }
  openTrendingPopover();
  showStatus(trendingResults, 'Loading trending titles...');
  try {
    const response = await fetch('/api/trending');
    if (!response.ok) {
      showStatus(trendingResults, 'Unable to load trending titles.');
      return;
    }
    const data = await response.json();
    if (!data.results || !data.results.length) {
      showStatus(trendingResults, 'No trending titles found.');
      return;
    }
    renderTrendingResults(data.results);
  } catch (error) {
    showStatus(trendingResults, 'Unable to load trending titles.');
  }
};

const addToList = async (item, watched, cardNode) => {
  const response = await fetch('/api/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...item, room, watched })
  });
  if (!response.ok) {
    alert('Failed to add item.');
    return;
  }
  if (cardNode) {
    cardNode.querySelector('.card-action.primary').textContent = 'Added';
  }
  pageState[watched ? 'watched' : 'unwatched'] = 1;
  await loadList();
};

const syncOrder = async () => {
  const order = Array.from(listResults.querySelectorAll('.card')).map(
    (card) => card.dataset.titleId
  );
  if (!order.length) {
    return;
  }
  const response = await fetch('/api/list/order', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, order })
  });
  if (!response.ok) {
    alert('Failed to save order.');
  }
};

const moveItemToTop = async (card) => {
  if (!card || !listResults) {
    return;
  }
  listResults.prepend(card);
  await syncOrder();
};

const getDragAfterElement = (container, y) => {
  const cards = [
    ...container.querySelectorAll('.card:not(.dragging):not(.drag-placeholder)')
  ];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  cards.forEach((card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: card };
    }
  });
  return closest.element;
};

const onPointerDragMove = (event) => {
  if (!draggingCard || event.pointerId !== draggingPointerId) {
    return;
  }
  event.preventDefault();
  draggingOffsetY = event.clientY - draggingStartY;
  draggingCard.style.transform = `translateY(${draggingOffsetY}px)`;
  const afterElement = getDragAfterElement(listResults, event.clientY);
  if (!dragPlaceholder) {
    return;
  }
  if (!afterElement) {
    listResults.appendChild(dragPlaceholder);
    return;
  }
  listResults.insertBefore(dragPlaceholder, afterElement);
};

const onPointerDragEnd = async () => {
  if (!draggingCard) {
    return;
  }
  listResults.querySelectorAll('.card').forEach((card) => {
    card.style.transform = '';
  });
  draggingCard.style.transform = '';
  draggingCard.style.position = '';
  draggingCard.style.left = '';
  draggingCard.style.top = '';
  draggingCard.style.width = '';
  draggingCard.classList.remove('dragging');
  if (dragPlaceholder) {
    listResults.insertBefore(draggingCard, dragPlaceholder);
    dragPlaceholder.remove();
    dragPlaceholder = null;
  }
  draggingCard = null;
  draggingPointerId = null;
  draggingStartY = 0;
  draggingOffsetY = 0;
  dragOriginRect = null;
  listResults.classList.remove('is-dragging');
  await syncOrder();
};

const stopPointerDragListeners = () => {
  if (!activeDragHandle || draggingPointerId === null) {
    return;
  }
  activeDragHandle.releasePointerCapture(draggingPointerId);
  document.removeEventListener('pointermove', onPointerDragMove);
  document.removeEventListener('pointerup', onPointerDragPointerUp);
  document.removeEventListener('pointercancel', onPointerDragPointerCancel);
  activeDragHandle = null;
};

const onPointerDragPointerUp = (event) => {
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  stopPointerDragListeners();
  onPointerDragEnd();
};

const onPointerDragPointerCancel = (event) => {
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  stopPointerDragListeners();
  onPointerDragEnd();
};

const attachDragHandlers = () => {
  listResults.querySelectorAll('.card').forEach((card) => {
    card.querySelectorAll('.card-drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        const targetCard = event.currentTarget.closest('.card');
        if (!targetCard) {
          return;
        }
        if (draggingCard) {
          stopPointerDragListeners();
        }
        draggingCard = targetCard;
        draggingPointerId = event.pointerId;
        dragOriginRect = targetCard.getBoundingClientRect();
        draggingStartY = event.clientY;
        draggingOffsetY = 0;
        activeDragHandle = event.currentTarget;
        listResults.classList.add('is-dragging');
        targetCard.classList.add('dragging');
        dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'card drag-placeholder';
        dragPlaceholder.style.height = `${dragOriginRect.height}px`;
        dragPlaceholder.style.width = `${dragOriginRect.width}px`;
        listResults.insertBefore(dragPlaceholder, targetCard.nextSibling);
        listResults.classList.add('is-dragging');
        targetCard.style.position = 'fixed';
        targetCard.style.left = `${dragOriginRect.left}px`;
        targetCard.style.top = `${dragOriginRect.top}px`;
        targetCard.style.width = `${dragOriginRect.width}px`;
        event.currentTarget.setPointerCapture(event.pointerId);
        document.addEventListener('pointermove', onPointerDragMove, { passive: false });
        document.addEventListener('pointerup', onPointerDragPointerUp);
        document.addEventListener('pointercancel', onPointerDragPointerCancel);
        event.preventDefault();
      });
    });
  });
};

const toggleWatched = async (item) => {
  const response = await fetch('/api/list', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title_id: item.title_id, room, watched: item.watched ? 0 : 1 })
  });
  if (!response.ok) {
    alert('Failed to update item.');
    return;
  }
  await loadList();
};

const removeFromList = async (item) => {
  const response = await fetch('/api/list', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title_id: item.title_id, room })
  });
  if (!response.ok) {
    alert('Failed to remove item.');
    return;
  }
  await loadList();
};

const setActiveTab = (nextTab) => {
  activeTab = nextTab;
  tabWatchlist.classList.toggle('active', activeTab === 'unwatched');
  tabWatched.classList.toggle('active', activeTab === 'watched');
  loadList();
};

searchButton.addEventListener('click', fetchSearch);
searchInput.addEventListener('input', debounceSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    fetchSearch();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchModal?.classList.contains('is-visible')) {
    closeSearchModal();
  }
  if (event.key === 'Escape' && trendingPopover?.classList.contains('is-visible')) {
    closeTrendingPopover();
  }
  if (event.key === 'Escape' && imageModal?.classList.contains('is-visible')) {
    closeImageModal();
  }
});
document.addEventListener('click', (event) => {
  const target = event.target;
  if (
    target instanceof Element &&
    (searchModal?.contains(target) ||
      trendingPopover?.contains(target) ||
      searchInput.contains(target) ||
      searchButton.contains(target) ||
      trendingButton?.contains(target))
  ) {
    return;
  }
  closeSearchModal();
  closeTrendingPopover();
});
imageModalClose?.addEventListener('click', closeImageModal);
imageModal?.addEventListener('click', (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});
  if (changeListButton) {
  const closeRenameModal = () => {
    if (!renameModal) {
      return;
    }
    renameModal.classList.remove('is-visible');
    renameModal.setAttribute('aria-hidden', 'true');
  };
  const openRenameModal = () => {
    if (!renameModal || !renameModalInput) {
      return;
    }
    renameModalInput.value = room;
    renameModal.classList.add('is-visible');
    renameModal.setAttribute('aria-hidden', 'false');
    renameModalInput.focus();
    renameModalInput.select();
  };

  changeListButton.addEventListener('click', () => {
    if (menu?.hasAttribute('open')) {
      menu.removeAttribute('open');
    }
    openRenameModal();
  });
  roomTagButton?.addEventListener('click', openRenameModal);
  trendingButton?.addEventListener('click', () => {
    closeSearchModal();
    if (trendingPopover?.classList.contains('is-visible')) {
      closeTrendingPopover();
      return;
    }
    fetchTrending();
  });
  refreshDatabaseButton?.addEventListener('click', async () => {
    if (menu?.hasAttribute('open')) {
      menu.removeAttribute('open');
    }
    openRefreshConfirmModal();
  });

  renameModalCancel?.addEventListener('click', closeRenameModal);
  renameModalClose?.addEventListener('click', closeRenameModal);
  renameModal?.addEventListener('click', (event) => {
    if (event.target === renameModal) {
      closeRenameModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && renameModal?.classList.contains('is-visible')) {
      closeRenameModal();
    }
  });
  renameModalInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renameModalConfirm?.click();
    }
  });

  renameModalConfirm?.addEventListener('click', async () => {
    if (!renameModalInput) {
      return;
    }
    const nextRoom = sanitizeRoom(renameModalInput.value);
    if (!nextRoom || nextRoom === room) {
      closeRenameModal();
      return;
    }
    const response = await fetch('/api/list/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, next_room: nextRoom })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.message || 'Unable to rename list.');
      return;
    }
    window.location.href = `/r/${encodeURIComponent(nextRoom)}`;
  });
}

refreshConfirmCancel?.addEventListener('click', closeRefreshConfirmModal);
refreshConfirmClose?.addEventListener('click', closeRefreshConfirmModal);
refreshConfirmModal?.addEventListener('click', (event) => {
  if (event.target === refreshConfirmModal) {
    closeRefreshConfirmModal();
  }
});
  refreshConfirmStart?.addEventListener('click', async () => {
    closeRefreshConfirmModal();
    refreshOwner = true;
    openRefreshProgressModal();
    updateRefreshProgress({ refreshing: true, processed: 0, total: 0 });
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room })
      });
      if (!response.ok) {
        refreshOwner = false;
        closeRefreshProgressModal();
        if (response.status === 409) {
          alert('A database refresh is already in progress.');
          pollRefreshStatus();
          return;
        }
        alert('Unable to refresh database.');
        return;
      }
      detailCache.clear();
      startRefreshPolling();
      pollRefreshStatus();
    } catch (error) {
      refreshOwner = false;
      closeRefreshProgressModal();
      alert('Unable to refresh database.');
    }
});
refreshProgressClose?.addEventListener('click', () => {
  if (refreshOwner) {
    return;
  }
  closeRefreshProgressModal();
});
refreshProgressModal?.addEventListener('click', (event) => {
  if (event.target === refreshProgressModal && !refreshOwner) {
    closeRefreshProgressModal();
  }
});

tabWatchlist.addEventListener('click', () => setActiveTab('unwatched'));
tabWatched.addEventListener('click', () => setActiveTab('watched'));

listPrev?.addEventListener('click', () => {
  if (pageState[activeTab] > 1) {
    pageState[activeTab] -= 1;
    loadList();
  }
});
listNext?.addEventListener('click', () => {
  if (pageState[activeTab] < totalPages[activeTab]) {
    pageState[activeTab] += 1;
    loadList();
  }
});

loadList();
renderSearchResults([]);
