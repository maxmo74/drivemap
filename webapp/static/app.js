const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const listResults = document.getElementById('list-results');
const refreshButton = document.getElementById('refresh-button');
const cardTemplate = document.getElementById('result-card-template');

const showStatus = (container, message) => {
  container.innerHTML = `<p class="card-meta">${message}</p>`;
};

const buildCard = (item, actionLabel, actionHandler) => {
  const card = cardTemplate.content.cloneNode(true);
  const article = card.querySelector('.card');
  const image = card.querySelector('.card-image');
  const title = card.querySelector('.card-title');
  const meta = card.querySelector('.card-meta');
  const rating = card.querySelector('.card-rating');
  const action = card.querySelector('.card-action');

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
  action.textContent = actionLabel;
  action.addEventListener('click', () => actionHandler(item, article));

  return card;
};

const renderSearchResults = (items) => {
  searchResults.innerHTML = '';
  if (!items.length) {
    showStatus(searchResults, 'No results yet. Try searching for a title.');
    return;
  }
  items.forEach((item) => {
    const card = buildCard(item, 'Add', addToList);
    searchResults.appendChild(card);
  });
};

const renderList = (items) => {
  listResults.innerHTML = '';
  if (!items.length) {
    showStatus(listResults, 'Your list is empty. Add something from the search results.');
    return;
  }
  items.forEach((item) => {
    const card = buildCard(item, 'Remove', removeFromList);
    listResults.appendChild(card);
  });
};

const fetchSearch = async () => {
  const query = searchInput.value.trim();
  if (!query) {
    showStatus(searchResults, 'Type a title to search.');
    return;
  }
  showStatus(searchResults, 'Searching...');
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    showStatus(searchResults, 'Search failed. Try again later.');
    return;
  }
  const data = await response.json();
  renderSearchResults(data.results || []);
};

const loadList = async () => {
  showStatus(listResults, 'Loading list...');
  const response = await fetch(`/api/list?room=${encodeURIComponent(room)}`);
  if (!response.ok) {
    showStatus(listResults, 'Unable to load list.');
    return;
  }
  const data = await response.json();
  renderList(data.items || []);
};

const addToList = async (item, cardNode) => {
  const response = await fetch('/api/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...item, room })
  });
  if (!response.ok) {
    alert('Failed to add item.');
    return;
  }
  cardNode.querySelector('.card-action').textContent = 'Added';
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

searchButton.addEventListener('click', fetchSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    fetchSearch();
  }
});
refreshButton.addEventListener('click', loadList);

loadList();
renderSearchResults([]);
