const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const clearSearchButton = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');
const listResults = document.getElementById('list-results');
const refreshButton = document.getElementById('refresh-button');
const tabWatchlist = document.getElementById('tab-watchlist');
const tabWatched = document.getElementById('tab-watched');
const cardTemplate = document.getElementById('result-card-template');
const changeListButton = document.getElementById('change-list-id');
const menu = document.querySelector('.menu');
const renameModal = document.getElementById('rename-modal');
const renameModalInput = document.getElementById('rename-modal-input');
const renameModalCancel = document.getElementById('rename-modal-cancel');
const renameModalConfirm = document.getElementById('rename-modal-confirm');
const renameModalClose = document.getElementById('rename-modal-close');

let activeTab = 'unwatched';
let searchTimer;
let activeSearchController;
let lastSearchQuery = '';
let lastSearchResults = [];
let draggingCard = null;
let draggingPointerId = null;
let draggingStartY = 0;
let draggingOffsetY = 0;
let isReordering = false;
let activeDragHandle = null;

const showStatus = (container, message) => {
  container.innerHTML = `<p class="card-meta">${message}</p>`;
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

  article.dataset.titleId = item.title_id;
  image.src = item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  image.alt = `${item.title} poster`;
  title.textContent = item.title;
  title.href = `https://www.imdb.com/title/${item.title_id}/`;
  const parts = [];
  if (item.type_label) {
    parts.push(item.type_label.toUpperCase());
  }
  if (item.year) {
    parts.push(item.year);
  }
  meta.textContent = parts.join(' • ') || 'Unknown';
  rating.textContent = item.rating ? `IMDB ${item.rating}` : 'IMDB rating unavailable';

  if (mode === 'search') {
    addButton.textContent = '＋';
    addButton.setAttribute('aria-label', 'Add to watchlist');
    addButton.title = 'Add to watchlist';
    watchedButton.textContent = '✓';
    watchedButton.setAttribute('aria-label', 'Add as watched');
    watchedButton.title = 'Add as watched';
    removeButton.remove();
    dragHandle.remove();
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
    if (activeTab !== 'unwatched') {
      dragHandle.remove();
    }
  }

  return card;
};

const renderSearchResults = (items) => {
  searchResults.innerHTML = '';
  if (!items.length) {
    return;
  }
  items.forEach((item) => {
    const card = buildCard(item, 'search');
    searchResults.appendChild(card);
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
      showStatus(searchResults, 'Searching...');
    }
  } else {
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
      showStatus(searchResults, 'Search failed. Try again later.');
      return;
    }
    const data = await response.json();
    lastSearchQuery = query;
    lastSearchResults = data.results || [];
    renderSearchResults(lastSearchResults);
  } catch (error) {
    if (error.name !== 'AbortError') {
      showStatus(searchResults, 'Search failed. Try again later.');
    }
  }
};

const debounceSearch = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchSearch, 1000);
};

const updateClearButton = () => {
  if (!clearSearchButton) {
    return;
  }
  clearSearchButton.disabled = searchInput.value.trim().length === 0;
};

const clearSearch = () => {
  searchInput.value = '';
  lastSearchQuery = '';
  lastSearchResults = [];
  if (activeSearchController) {
    activeSearchController.abort();
    activeSearchController = null;
  }
  renderSearchResults([]);
  updateClearButton();
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

const onDragMove = (event) => {
  if (!draggingCard) {
    return;
  }
  event.preventDefault();
  const hoveredCards = document.elementsFromPoint(event.clientX, event.clientY);
  const targetCard = hoveredCards
    .map((node) => node.closest?.('.card'))
    .find((card) => card && card !== draggingCard && card.parentElement === listResults);
  if (!targetCard || targetCard === draggingCard || targetCard.parentElement !== listResults) {
    draggingOffsetY = event.clientY - draggingStartY;
    draggingCard.style.transform = `translateY(${draggingOffsetY}px)`;
    return;
  }
  const cards = Array.from(listResults.querySelectorAll('.card'));
  const positions = new Map(cards.map((card) => [card, card.getBoundingClientRect()]));
  const rect = targetCard.getBoundingClientRect();
  const insertBefore = event.clientY < rect.top + rect.height / 2;
  const previousTop = draggingCard.getBoundingClientRect().top;
  listResults.insertBefore(draggingCard, insertBefore ? targetCard : targetCard.nextSibling);
  const nextTop = draggingCard.getBoundingClientRect().top;
  const topDelta = nextTop - previousTop;
  if (Math.abs(topDelta) > 0.5) {
    draggingStartY += topDelta;
  }
  draggingOffsetY = event.clientY - draggingStartY;
  draggingCard.style.transform = `translateY(${draggingOffsetY}px)`;
  cards.forEach((card) => {
    if (card === draggingCard) {
      return;
    }
    const oldRect = positions.get(card);
    const newRect = card.getBoundingClientRect();
    const deltaY = oldRect.top - newRect.top;
    if (Math.abs(deltaY) > 0.5) {
      card.style.transform = `translateY(${deltaY}px)`;
    }
  });
  if (!isReordering) {
    isReordering = true;
    listResults.classList.add('is-reordering');
  }
  requestAnimationFrame(() => {
    cards.forEach((card) => {
      if (card === draggingCard) {
        return;
      }
      card.style.transform = '';
    });
  });
};

const onDragEnd = async () => {
  if (!draggingCard) {
    return;
  }
  listResults.querySelectorAll('.card').forEach((card) => {
    card.style.transform = '';
  });
  draggingCard.style.transform = '';
  draggingCard.classList.remove('dragging');
  draggingCard = null;
  draggingPointerId = null;
  draggingStartY = 0;
  draggingOffsetY = 0;
  listResults.classList.remove('is-reordering');
  isReordering = false;
  await syncOrder();
};

const stopDragListeners = () => {
  if (!activeDragHandle || draggingPointerId === null) {
    return;
  }
  activeDragHandle.releasePointerCapture(draggingPointerId);
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragPointerUp);
  document.removeEventListener('pointercancel', onDragPointerCancel);
  listResults.classList.remove('is-dragging');
  activeDragHandle = null;
};

const onDragPointerUp = (event) => {
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  stopDragListeners();
  onDragEnd();
};

const onDragPointerCancel = (event) => {
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  stopDragListeners();
  onDragEnd();
};

const attachDragHandlers = () => {
  if (activeTab !== 'unwatched') {
    return;
  }
  listResults.querySelectorAll('.card-drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      const card = event.currentTarget.closest('.card');
      if (!card) {
        return;
      }
      if (draggingCard) {
        stopDragListeners();
      }
      draggingCard = card;
      draggingPointerId = event.pointerId;
      draggingStartY = event.clientY;
      draggingOffsetY = 0;
      activeDragHandle = event.currentTarget;
      listResults.classList.add('is-dragging');
      card.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
      document.addEventListener('pointermove', onDragMove);
      document.addEventListener('pointerup', onDragPointerUp);
      document.addEventListener('pointercancel', onDragPointerCancel);
      event.preventDefault();
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
searchInput.addEventListener('input', updateClearButton);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    debounceSearch();
  }
});
clearSearchButton?.addEventListener('click', clearSearch);
refreshButton.addEventListener('click', loadList);
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
updateClearButton();
