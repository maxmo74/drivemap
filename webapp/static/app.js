const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const searchModal = document.getElementById('search-modal');
const searchModalClose = document.getElementById('search-modal-close');
const trendingResults = document.getElementById('trending-results');
const trendingModal = document.getElementById('trending-modal');
const trendingModalClose = document.getElementById('trending-modal-close');
const listResults = document.getElementById('list-results');
const tabWatchlist = document.getElementById('tab-watchlist');
const tabWatched = document.getElementById('tab-watched');
const cardTemplate = document.getElementById('result-card-template');
const changeListButton = document.getElementById('change-list-id');
const trendingButton = document.getElementById('open-trending');
const menu = document.querySelector('.menu');
const roomTagButton = document.getElementById('room-tag-button');
const renameModal = document.getElementById('rename-modal');
const renameModalInput = document.getElementById('rename-modal-input');
const renameModalCancel = document.getElementById('rename-modal-cancel');
const renameModalConfirm = document.getElementById('rename-modal-confirm');
const renameModalClose = document.getElementById('rename-modal-close');
const imageModal = document.getElementById('image-modal');
const imageModalClose = document.getElementById('image-modal-close');
const imageModalImage = document.getElementById('image-modal-image');

const MAX_RESULTS = 10;
let activeTab = 'unwatched';
let searchTimer;
let activeSearchController;
let lastSearchQuery = '';
let lastSearchResults = [];
let dragSource = null;

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

const openTrendingModal = () => {
  if (!trendingModal) {
    return;
  }
  trendingModal.classList.add('is-visible');
  trendingModal.setAttribute('aria-hidden', 'false');
};

const closeTrendingModal = () => {
  if (!trendingModal) {
    return;
  }
  trendingModal.classList.remove('is-visible');
  trendingModal.setAttribute('aria-hidden', 'true');
};

const sanitizeRoom = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

const buildCard = (item, mode) => {
  const card = cardTemplate.content.cloneNode(true);
  const article = card.querySelector('.card');
  const image = card.querySelector('.card-image');
  const title = card.querySelector('.card-title-link');
  const meta = card.querySelector('.card-meta');
  const rating = card.querySelector('.card-rating');
  const addButton = card.querySelector('.card-action.primary');
  const watchedButton = card.querySelector('.card-action.secondary');
  const removeButton = card.querySelector('.card-action.danger');
  const dragHandle = card.querySelector('.card-drag-handle');
  const moveUpButton = card.querySelector('.card-action.move-up');
  const moveDownButton = card.querySelector('.card-action.move-down');

  article.dataset.titleId = item.title_id;
  image.src = item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  image.alt = `${item.title} poster`;
  title.textContent = item.title;
  title.href = `https://www.imdb.com/title/${item.title_id}/`;
  image.addEventListener('click', () => {
    openImageModal(getLargeImage(item.image), `${item.title} poster`);
  });
  const parts = [];
  if (item.type_label) {
    parts.push(item.type_label.toUpperCase());
  }
  if (item.year) {
    parts.push(item.year);
  }
  meta.textContent = parts.join(' • ') || 'Unknown';
  const imdbRating = item.rating || 'N/A';
  const rottenRating = item.rotten_tomatoes || 'N/A';
  rating.innerHTML = `
    <span class="rating-badge">
      <img src="/static/imdb-logo.svg" alt="IMDb" />
      <span>${imdbRating}</span>
    </span>
    <span class="rating-badge">
      <img src="/static/rotten-tomatoes.svg" alt="Rotten Tomatoes" />
      <span>${rottenRating}</span>
    </span>
  `;

  if (mode === 'search') {
    addButton.textContent = '＋';
    addButton.setAttribute('aria-label', 'Add to watchlist');
    addButton.title = 'Add to watchlist';
    watchedButton.textContent = '✓';
    watchedButton.setAttribute('aria-label', 'Add as watched');
    watchedButton.title = 'Add as watched';
    removeButton.remove();
    dragHandle.remove();
    moveUpButton.remove();
    moveDownButton.remove();
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
  }

  return card;
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
  });
};

const renderTrendingResults = (items) => {
  trendingResults.innerHTML = '';
  const limited = items.slice(0, MAX_RESULTS);
  if (!limited.length) {
    return;
  }
  openTrendingModal();
  limited.forEach((item) => {
    const card = buildCard(item, 'search');
    trendingResults.appendChild(card);
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
  searchTimer = setTimeout(fetchSearch, 1000);
};

const loadList = async () => {
  showStatus(listResults, 'Loading list...');
  const response = await fetch(`/api/list?room=${encodeURIComponent(room)}&status=${activeTab}`);
  if (!response.ok) {
    showStatus(listResults, 'Unable to load list.');
    return;
  }
  const data = await response.json();
  renderList(data.items || []);
};

const fetchTrending = async () => {
  if (!trendingResults) {
    return;
  }
  openTrendingModal();
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

const attachDragHandlers = () => {
  listResults.querySelectorAll('.card').forEach((card) => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (event) => {
      if (!event.target.closest('.card-drag-handle')) {
        event.preventDefault();
        return;
      }
      dragSource = card;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.titleId || '');
    });
    card.addEventListener('dragend', async () => {
      if (!dragSource) {
        return;
      }
      dragSource.classList.remove('dragging');
      dragSource = null;
      await syncOrder();
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
    debounceSearch();
  }
});
searchModalClose?.addEventListener('click', closeSearchModal);
searchModal?.addEventListener('click', (event) => {
  if (event.target === searchModal) {
    closeSearchModal();
  }
});
trendingModalClose?.addEventListener('click', closeTrendingModal);
trendingModal?.addEventListener('click', (event) => {
  if (event.target === trendingModal) {
    closeTrendingModal();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchModal?.classList.contains('is-visible')) {
    closeSearchModal();
  }
  if (event.key === 'Escape' && trendingModal?.classList.contains('is-visible')) {
    closeTrendingModal();
  }
  if (event.key === 'Escape' && imageModal?.classList.contains('is-visible')) {
    closeImageModal();
  }
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
    if (menu?.hasAttribute('open')) {
      menu.removeAttribute('open');
    }
    fetchTrending();
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

tabWatchlist.addEventListener('click', () => setActiveTab('unwatched'));
tabWatched.addEventListener('click', () => setActiveTab('watched'));

loadList();
renderSearchResults([]);

listResults?.addEventListener('dragover', (event) => {
  event.preventDefault();
  const targetCard = event.target.closest('.card');
  if (!dragSource || !targetCard || targetCard === dragSource) {
    return;
  }
  if (targetCard.parentElement !== listResults) {
    return;
  }
  const rect = targetCard.getBoundingClientRect();
  const insertBefore = event.clientY < rect.top + rect.height / 2;
  listResults.insertBefore(dragSource, insertBefore ? targetCard : targetCard.nextSibling);
});
