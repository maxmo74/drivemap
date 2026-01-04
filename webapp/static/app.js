const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const listResults = document.getElementById('list-results');
const refreshButton = document.getElementById('refresh-button');
const tabWatchlist = document.getElementById('tab-watchlist');
const tabWatched = document.getElementById('tab-watched');
const cardTemplate = document.getElementById('result-card-template');

let activeTab = 'unwatched';
let searchTimer;
let activeSearchController;
let lastSearchQuery = '';
let lastSearchResults = [];
let draggingCard = null;
let draggingPointerId = null;
let draggingStartY = 0;
let draggingOffsetY = 0;

const showStatus = (container, message) => {
  container.innerHTML = `<p class="card-meta">${message}</p>`;
};

const buildCard = (item, mode) => {
  const card = cardTemplate.content.cloneNode(true);
  const article = card.querySelector('.card');
  const image = card.querySelector('.card-image');
  const title = card.querySelector('.card-title');
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
    addButton.textContent = 'Add';
    watchedButton.textContent = 'Add as watched';
    removeButton.remove();
    dragHandle.remove();
    addButton.addEventListener('click', () => addToList(item, false, article));
    watchedButton.addEventListener('click', () => addToList(item, true, article));
  } else {
    addButton.textContent = item.watched ? 'Move to watchlist' : 'Mark watched';
    watchedButton.remove();
    removeButton.textContent = 'Remove';
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
    showStatus(searchResults, 'No results yet. Try searching for a title.');
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
  if (query.length < 2) {
    showStatus(searchResults, 'Type at least 2 characters to search.');
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
  searchTimer = setTimeout(fetchSearch, 200);
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
  draggingOffsetY = event.clientY - draggingStartY;
  draggingCard.style.transform = `translateY(${draggingOffsetY}px)`;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const targetCard = target ? target.closest('.card') : null;
  if (!targetCard || targetCard === draggingCard || targetCard.parentElement !== listResults) {
    return;
  }
  const rect = targetCard.getBoundingClientRect();
  const insertBefore = event.clientY < rect.top + rect.height / 2;
  listResults.insertBefore(draggingCard, insertBefore ? targetCard : targetCard.nextSibling);
};

const onDragEnd = async () => {
  if (!draggingCard) {
    return;
  }
  draggingCard.style.transform = '';
  draggingCard.classList.remove('dragging');
  draggingCard = null;
  draggingPointerId = null;
  draggingStartY = 0;
  draggingOffsetY = 0;
  await syncOrder();
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
      draggingCard = card;
      draggingPointerId = event.pointerId;
      draggingStartY = event.clientY;
      draggingOffsetY = 0;
      card.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (draggingPointerId !== event.pointerId) {
        return;
      }
      onDragMove(event);
    });
    handle.addEventListener('pointerup', (event) => {
      if (draggingPointerId !== event.pointerId) {
        return;
      }
      event.currentTarget.releasePointerCapture(event.pointerId);
      onDragEnd();
    });
    handle.addEventListener('pointercancel', (event) => {
      if (draggingPointerId !== event.pointerId) {
        return;
      }
      event.currentTarget.releasePointerCapture(event.pointerId);
      onDragEnd();
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
    fetchSearch();
  }
});
refreshButton.addEventListener('click', loadList);

tabWatchlist.addEventListener('click', () => setActiveTab('unwatched'));
tabWatched.addEventListener('click', () => setActiveTab('watched'));

loadList();
renderSearchResults([]);
