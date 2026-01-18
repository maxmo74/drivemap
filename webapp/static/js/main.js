/**
 * Main entry point for Shovo
 */

import {
  loadSettings,
  saveSettings,
  ensureRoomState,
  encodeShareToken,
  decodeShareToken,
  isRoomPrivate,
  getRoomPassword,
  isRoomAuthorized,
  generatePassword
} from './settings.js';
import { openModal, closeModal, isModalOpen, getLargeImage, setupEscapeHandler } from './modal.js';
import {
  searchTitles,
  getTrending,
  getList,
  getDetails,
  addToList as apiAddToList,
  updateWatched,
  removeFromList as apiRemoveFromList,
  updateOrder,
  startRefresh,
  getRefreshStatus,
  MAX_RESULTS
} from './api.js';
import { buildCard, buildMobileSearchResult, applyCardDetails, needsDetails } from './cards.js';
import { attachDragHandlers, getCurrentOrder } from './drag.js';
import { setupMobileEnhancements } from './mobile.js';
import { getCached, setCached, getDetailCacheKey } from './cache.js';

// DOM Elements
const room = window.APP_ROOM;
const searchInput = document.getElementById('search-input');
const filterInput = document.getElementById('filter-input');
const searchResults = document.getElementById('search-results');
const searchModal = document.getElementById('search-modal');
const trendingResults = document.getElementById('trending-results');
const trendingPopover = document.getElementById('trending-popover');
const listResults = document.getElementById('list-results');
const tabWatchlist = document.getElementById('tab-watchlist');
const tabWatched = document.getElementById('tab-watched');
const countWatchlist = document.getElementById('count-watchlist');
const countWatched = document.getElementById('count-watched');
const cardTemplate = document.getElementById('result-card-template');
const trendingButton = document.getElementById('trending-button');
const refreshDatabaseButton = document.getElementById('refresh-database');
const menu = document.querySelector('.menu');
const roomTagButton = document.getElementById('room-tag-button');
const roomVisibility = document.getElementById('room-visibility');
const roomCount = document.getElementById('room-count');
const shareRoomButton = document.getElementById('share-room');
const appVersionTag = document.getElementById('app-version-tag');
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
const aboutModal = document.getElementById('about-modal');
const aboutModalClose = document.getElementById('about-modal-close');
const aboutOpenButton = document.getElementById('open-about');
const openOptionsButton = document.getElementById('open-options');
const optionsModal = document.getElementById('options-modal');
const optionsModalClose = document.getElementById('options-modal-close');
const optionCompact = document.getElementById('option-compact');
const defaultRoomSelect = document.getElementById('default-room-select');
const visitedRoomsContainer = document.getElementById('visited-rooms');
const shareModal = document.getElementById('share-modal');
const shareModalClose = document.getElementById('share-modal-close');
const shareCopyButton = document.getElementById('share-copy');
const shareEmailButton = document.getElementById('share-email');
const shareWhatsAppButton = document.getElementById('share-whatsapp');
const shareMessengerButton = document.getElementById('share-messenger');
const shareTelegramButton = document.getElementById('share-telegram');
const shareInstagramButton = document.getElementById('share-instagram');
const shareModalMessage = document.getElementById('share-modal-message');
const searchClearButton = document.getElementById('search-clear');
const filterClearButton = document.getElementById('filter-clear');
const privacyModal = document.getElementById('privacy-modal');
const privacyPasswordInput = document.getElementById('privacy-password');
const privacyCancelButton = document.getElementById('privacy-cancel');
const privacyUnlockButton = document.getElementById('privacy-unlock');
const privacyError = document.getElementById('privacy-error');
const listPagination = document.getElementById('list-pagination');
const listPrev = document.getElementById('list-prev');
const listNext = document.getElementById('list-next');
const listPageStatus = document.getElementById('list-page-status');

// State
const PAGE_SIZE = 10;
let activeTab = 'unwatched';
let searchTimer;
let activeSearchController;
let lastSearchQuery = '';
let lastSearchResults = [];
const pageState = { unwatched: 1, watched: 1 };
const totalPages = { unwatched: 1, watched: 1 };
const pendingDetailRequests = new Set();
const detailCache = new Map();
let refreshPollingTimer;
let refreshOwner = false;
const preloadedTabs = new Set();
let currentListItems = [];
let settings = loadSettings();

// Helper functions
const showStatus = (container, message) => {
  container.innerHTML = `<p class="card-meta">${message}</p>`;
};

const updateRoomVisibilityBadge = () => {
  if (!roomVisibility) return;
  if (isRoomPrivate(settings, room)) {
    roomVisibility.textContent = 'Private';
    roomVisibility.classList.add('is-private');
  } else {
    roomVisibility.textContent = 'Public';
    roomVisibility.classList.remove('is-private');
  }
};

const updateRoomCount = () => {
  if (!roomCount) return;
  const total = Object.keys(settings.rooms).length || 1;
  roomCount.textContent = `${total} ${total === 1 ? 'list' : 'lists'}`;
};

const applyCompactSetting = () => {
  document.body.classList.toggle('compact-list', settings.compact);
  if (optionCompact) optionCompact.checked = settings.compact;
};

const applyFilter = (items) => {
  const query = filterInput?.value.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => item.title.toLowerCase().includes(query));
};

// Modal functions
const openImageModal = (src, alt) => {
  if (!imageModal || !imageModalImage) return;
  imageModalImage.src = src;
  imageModalImage.alt = alt;
  openModal(imageModal);
};

const closeImageModal = () => {
  closeModal(imageModal);
  if (imageModalImage) imageModalImage.src = '';
};

const openSearchModal = () => {
  closeTrendingPopover();
  openModal(searchModal);
};

const closeSearchModal = () => closeModal(searchModal);
const openTrendingPopover = () => openModal(trendingPopover);
const closeTrendingPopover = () => closeModal(trendingPopover);
const openAboutModal = () => openModal(aboutModal);
const closeAboutModal = () => closeModal(aboutModal);
const openRefreshConfirmModal = () => openModal(refreshConfirmModal);
const closeRefreshConfirmModal = () => closeModal(refreshConfirmModal);
const openRefreshProgressModal = () => openModal(refreshProgressModal);
const closeRefreshProgressModal = () => closeModal(refreshProgressModal);
const openOptionsModal = () => {
  renderDefaultRoomOptions();
  renderVisitedRooms();
  updateVisitedRoomCounts();
  openModal(optionsModal);
};
const closeOptionsModal = () => closeModal(optionsModal);
const openPrivacyModal = () => {
  privacyError?.setAttribute('hidden', '');
  if (privacyPasswordInput) privacyPasswordInput.value = '';
  openModal(privacyModal);
  privacyPasswordInput?.focus();
};
const closePrivacyModal = () => closeModal(privacyModal);

const openShareModal = () => {
  if (!shareModal) return;
  const token = encodeShareToken({
    room,
    password: isRoomPrivate(settings, room) ? getRoomPassword(settings, room) : ''
  });
  const shareUrl = `${window.location.origin}/r/${encodeURIComponent(room)}?share=${token}`;
  shareModalMessage.textContent = isRoomPrivate(settings, room)
    ? 'Sharing will include a secure token to access this private list.'
    : 'This list is public. Share the link below.';
  shareModal.dataset.shareUrl = shareUrl;
  openModal(shareModal);
};
const closeShareModal = () => closeModal(shareModal);

// Card handlers
const cardHandlers = {
  onImageClick: openImageModal,
  onAdd: async (item, watched, cardNode) => {
    const cachedDetails = detailCache.get(item.title_id) || {};
    try {
      await apiAddToList(room, { ...item, ...cachedDetails }, watched);
      if (cardNode) {
        cardNode.querySelector('.card-action.primary').textContent = 'Added';
      }
      pageState[watched ? 'watched' : 'unwatched'] = 1;
      await loadList();
    } catch (error) {
      alert('Failed to add item.');
    }
  },
  onAddWatched: async (item, watched, cardNode) => {
    const cachedDetails = detailCache.get(item.title_id) || {};
    try {
      await apiAddToList(room, { ...item, ...cachedDetails }, watched);
      if (cardNode) {
        cardNode.querySelector('.card-action.secondary').textContent = 'Added';
      }
      pageState.watched = 1;
      await loadList();
    } catch (error) {
      alert('Failed to add item.');
    }
  },
  onToggleWatched: async (item) => {
    try {
      await updateWatched(room, item.title_id, !item.watched);
      await loadList();
    } catch (error) {
      alert('Failed to update item.');
    }
  },
  onRemove: async (item) => {
    try {
      await apiRemoveFromList(room, item.title_id);
      await loadList();
    } catch (error) {
      alert('Failed to remove item.');
    }
  },
  onMoveTop: async (card) => {
    if (!card || !listResults) return;
    listResults.prepend(card);
    await syncOrder();
  }
};

// Detail fetching
const requestDetails = async (item, article) => {
  if (!needsDetails(item) || pendingDetailRequests.has(item.title_id)) return;

  // Check in-memory cache
  if (detailCache.has(item.title_id)) {
    applyCardDetails(article, { ...item, ...detailCache.get(item.title_id) });
    return;
  }

  // Check localStorage cache
  const localCached = getCached(getDetailCacheKey(item.title_id));
  if (localCached) {
    detailCache.set(item.title_id, localCached);
    applyCardDetails(article, { ...item, ...localCached });
    return;
  }

  pendingDetailRequests.add(item.title_id);
  try {
    const details = await getDetails(item.title_id, item.type_label || '');
    detailCache.set(item.title_id, details);
    setCached(getDetailCacheKey(item.title_id), details);
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

// Rendering
const renderSearchResults = (items) => {
  searchResults.innerHTML = '';
  const limited = items.slice(0, MAX_RESULTS);
  if (!limited.length) return;
  openSearchModal();
  
  // Check if we should use mobile layout
  const isMobileLayout = window.matchMedia('(max-width: 768px)').matches;
  const mobileTemplate = document.getElementById('mobile-search-card-template');
  
  if (isMobileLayout && mobileTemplate) {
    // Use mobile compact layout
    searchResults.classList.add('mobile-view');
    limited.forEach((item) => {
      const mobileResult = buildMobileSearchResult(item, mobileTemplate, (selectedItem) => {
        cardHandlers.onAdd(selectedItem, false);
      });
      searchResults.appendChild(mobileResult);
    });
  } else {
    // Use desktop layout
    searchResults.classList.remove('mobile-view');
    limited.forEach((item) => {
      const card = buildCard(item, 'search', cardTemplate, cardHandlers);
      searchResults.appendChild(card);
      requestDetails(item, card);
    });
  }
};

const renderTrendingResults = (items) => {
  trendingResults.innerHTML = '';
  const limited = items.slice(0, MAX_RESULTS);
  if (!limited.length) return;
  openTrendingPopover();
  const isMobileLayout = window.matchMedia('(max-width: 768px)').matches;
  const mobileTemplate = document.getElementById('mobile-search-card-template');
  
  if (isMobileLayout && mobileTemplate) {
    // Use mobile compact layout for trending results
    limited.forEach((item) => {
      const mobileResult = buildMobileSearchResult(item, mobileTemplate, (selectedItem) => {
        cardHandlers.onAdd(selectedItem, false);
      });
      trendingResults.appendChild(mobileResult);
    });
  } else {
    // Use desktop layout
    limited.forEach((item) => {
      const card = buildCard(item, 'list', cardTemplate, cardHandlers);
      trendingResults.appendChild(card);
      requestDetails(item, card);
    });
  }
};

const renderList = (items) => {
  listResults.innerHTML = '';
  if (!items.length) {
    const hasFilter = filterInput?.value.trim();
    if (hasFilter && currentListItems.length) {
      showStatus(listResults, 'No matches in this list.');
      return;
    }
    showStatus(
      listResults,
      activeTab === 'watched'
        ? 'No watched items yet.'
        : 'Your list is empty. Add something from the search results.'
    );
    return;
  }
  items.forEach((item) => {
    const card = buildCard(item, 'list', cardTemplate, cardHandlers);
    listResults.appendChild(card);
    requestDetails(item, card);
  });
  attachDragHandlers(listResults, syncOrder);
};

// API calls
const syncOrder = async () => {
  const order = getCurrentOrder(listResults);
  if (!order.length) return;
  try {
    await updateOrder(room, order);
  } catch (error) {
    alert('Failed to save order.');
  }
};

const filterCachedResults = (query) => {
  const normalized = query.toLowerCase();
  return lastSearchResults.filter((item) => item.title.toLowerCase().includes(normalized));
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
    const data = await searchTitles(query, activeSearchController.signal);
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
  if (isRoomPrivate(settings, room) && !isRoomAuthorized(settings, room)) {
    showStatus(listResults, 'This list is private. Enter the password to continue.');
    openPrivacyModal();
    return;
  }
  showStatus(listResults, 'Loading list...');
  const page = pageState[activeTab];
  try {
    const data = await getList(room, activeTab, page, PAGE_SIZE);
    if (!data.items?.length && page > 1) {
      pageState[activeTab] = page - 1;
      await loadList();
      return;
    }
    totalPages[activeTab] = data.total_pages || 1;
    currentListItems = data.items || [];
    renderList(applyFilter(currentListItems));
    if (activeTab === 'unwatched' && countWatchlist) {
      countWatchlist.textContent = String(data.total_count || 0);
    }
    if (activeTab === 'watched' && countWatched) {
      countWatched.textContent = String(data.total_count || 0);
    }
    if (listPageStatus) {
      listPageStatus.textContent = `Page ${pageState[activeTab]} of ${totalPages[activeTab]}`;
    }
    if (listPrev) listPrev.disabled = pageState[activeTab] <= 1;
    if (listNext) listNext.disabled = pageState[activeTab] >= totalPages[activeTab];
    if (listPagination) {
      listPagination.style.display = totalPages[activeTab] > 1 ? 'flex' : 'none';
    }
    preloadTabImages(activeTab === 'watched' ? 'unwatched' : 'watched');
    pollRefreshStatus();
  } catch (error) {
    showStatus(listResults, 'Unable to load list.');
  }
};

const preloadTabImages = async (tab) => {
  if (!tab || preloadedTabs.has(tab)) return;
  preloadedTabs.add(tab);
  try {
    const data = await getList(room, tab, 1, PAGE_SIZE);
    (data.items || []).forEach((item) => {
      if (item.image) {
        const img = new Image();
        img.src = item.image;
      }
    });
  } catch (error) {
    // no-op
  }
};

const fetchTrending = async () => {
  if (!trendingResults) return;
  openTrendingPopover();
  showStatus(trendingResults, 'Loading trending titles...');
  try {
    const data = await getTrending();
    if (!data.results || !data.results.length) {
      showStatus(trendingResults, 'No trending titles found.');
      return;
    }
    renderTrendingResults(data.results);
  } catch (error) {
    showStatus(trendingResults, 'Unable to load trending titles.');
  }
};

// Refresh handling
const updateRefreshProgress = (state) => {
  if (!refreshProgressBar || !refreshProgressText || !refreshProgressTitle) return;
  const total = Number(state.total || 0);
  const processed = Number(state.processed || 0);
  const percent = total ? Math.round((processed / total) * 100) : 0;
  refreshProgressBar.max = 100;
  refreshProgressBar.value = percent;
  refreshProgressText.textContent = total ? `${processed} of ${total} items refreshed` : 'Preparing refresh…';
  if (!state.refreshing) {
    refreshProgressTitle.textContent = 'Refresh complete';
    refreshProgressText.textContent = total ? `${processed} of ${total} items refreshed` : 'Refresh completed.';
  } else {
    refreshProgressTitle.textContent = refreshOwner ? 'Refreshing database…' : 'Database refresh in progress…';
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
    const state = await getRefreshStatus(room);
    if (state.refreshing) {
      openRefreshProgressModal();
      updateRefreshProgress(state);
      if (!refreshPollingTimer) {
        startRefreshPolling();
      }
    } else if (isModalOpen(refreshProgressModal)) {
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

// Options modal helpers
const renderDefaultRoomOptions = () => {
  if (!defaultRoomSelect) return;
  defaultRoomSelect.innerHTML = '';
  const rooms = Object.keys(settings.rooms);
  rooms.forEach((roomId) => {
    const option = document.createElement('option');
    option.value = roomId;
    option.textContent = roomId;
    defaultRoomSelect.appendChild(option);
  });
  if (!rooms.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No lists yet';
    defaultRoomSelect.appendChild(option);
  }
  defaultRoomSelect.value = settings.defaultRoom || room;
};

const renderVisitedRooms = () => {
  if (!visitedRoomsContainer) return;
  visitedRoomsContainer.innerHTML = '';
  const rooms = Object.entries(settings.rooms).sort((a, b) => (b[1].lastVisited || 0) - (a[1].lastVisited || 0));
  rooms.forEach(([roomId, data]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'visited-room';
    wrapper.dataset.room = roomId;
    const countBadge = document.createElement('div');
    countBadge.className = 'visited-room-count';
    countBadge.textContent = data.count !== undefined ? String(data.count) : '…';
    const header = document.createElement('div');
    header.className = 'visited-room-header';
    const name = document.createElement('div');
    name.className = 'visited-room-name';
    name.textContent = roomId;
    const headerActions = document.createElement('div');
    headerActions.className = 'visited-room-actions';
    const status = document.createElement('span');
    status.className = 'visited-room-status room-visibility';
    status.textContent = data.private ? 'Private' : 'Public';
    if (data.private) status.classList.add('is-private');
    const openButton = document.createElement('button');
    openButton.className = 'ghost visited-room-open';
    openButton.type = 'button';
    openButton.textContent = 'Open';
    openButton.addEventListener('click', () => {
      window.location.href = `/r/${encodeURIComponent(roomId)}`;
    });
    headerActions.appendChild(status);
    headerActions.appendChild(openButton);
    header.appendChild(name);
    header.appendChild(headerActions);
    const toggleRow = document.createElement('label');
    toggleRow.className = 'visited-room-toggle';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = Boolean(data.private);
    toggle.addEventListener('change', () => {
      data.private = toggle.checked;
      if (data.private && !data.password) {
        data.password = generatePassword();
      }
      if (!data.private) {
        data.password = '';
        data.authorized = true;
      } else {
        data.authorized = true;
      }
      settings.rooms[roomId] = data;
      saveSettings(settings);
      updateRoomVisibilityBadge();
      renderVisitedRooms();
    });
    const toggleText = document.createElement('span');
    toggleText.textContent = 'Private list';
    toggleRow.appendChild(toggle);
    toggleRow.appendChild(toggleText);
    const password = document.createElement('div');
    password.className = 'visited-room-password';
    password.textContent = data.private ? `Password: ${data.password}` : 'Password: —';
    wrapper.appendChild(countBadge);
    wrapper.appendChild(header);
    wrapper.appendChild(toggleRow);
    wrapper.appendChild(password);
    visitedRoomsContainer.appendChild(wrapper);
  });
};

const updateVisitedRoomCounts = async () => {
  const rooms = Object.keys(settings.rooms);
  await Promise.all(
    rooms.map(async (roomId) => {
      try {
        const [unwatched, watched] = await Promise.all([
          getList(roomId, 'unwatched', 1, 1),
          getList(roomId, 'watched', 1, 1)
        ]);
        const total = (unwatched.total_count || 0) + (watched.total_count || 0);
        settings.rooms[roomId].count = total;
        const badge = visitedRoomsContainer?.querySelector(`[data-room="${roomId}"] .visited-room-count`);
        if (badge) badge.textContent = String(total);
      } catch (error) {
        // no-op
      }
    })
  );
  saveSettings(settings);
};

// Tab switching
const setActiveTab = (nextTab) => {
  activeTab = nextTab;
  tabWatchlist.classList.toggle('active', activeTab === 'unwatched');
  tabWatched.classList.toggle('active', activeTab === 'watched');
  loadList();
};

// Share token handling
const applyShareToken = () => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('share');
  if (!token) return;
  const payload = decodeShareToken(token);
  if (!payload || !payload.room) return;
  if (payload.room && payload.room !== room) {
    window.location.href = `/r/${encodeURIComponent(payload.room)}?share=${token}`;
    return;
  }
  ensureRoomState(settings, room);
  if (payload.password) {
    settings.rooms[room].private = true;
    settings.rooms[room].password = payload.password;
    settings.rooms[room].authorized = true;
    saveSettings(settings);
  }
};

// Initialize settings
const initializeSettings = () => {
  settings = loadSettings();
  ensureRoomState(settings, room);
  if (!settings.defaultRoom) {
    settings.defaultRoom = room;
  }
  applyCompactSetting();
  updateRoomVisibilityBadge();
  updateRoomCount();
  saveSettings(settings);
};

// Event listeners
searchInput.addEventListener('input', debounceSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    fetchSearch();
  }
});

filterInput?.addEventListener('input', () => {
  renderList(applyFilter(currentListItems));
});

searchClearButton?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  lastSearchQuery = '';
  lastSearchResults = [];
  closeSearchModal();
  searchInput.focus();
});

filterClearButton?.addEventListener('click', () => {
  if (!filterInput) return;
  filterInput.value = '';
  renderList(applyFilter(currentListItems));
  filterInput.focus();
});

// Modal close handlers
imageModalClose?.addEventListener('click', closeImageModal);
imageModal?.addEventListener('click', (event) => {
  if (event.target === imageModal) closeImageModal();
});

aboutModalClose?.addEventListener('click', closeAboutModal);
aboutModal?.addEventListener('click', (event) => {
  if (event.target === aboutModal) closeAboutModal();
});

optionsModalClose?.addEventListener('click', closeOptionsModal);
optionsModal?.addEventListener('click', (event) => {
  if (event.target === optionsModal) closeOptionsModal();
});

shareModalClose?.addEventListener('click', closeShareModal);
shareModal?.addEventListener('click', (event) => {
  if (event.target === shareModal) closeShareModal();
});

refreshConfirmCancel?.addEventListener('click', closeRefreshConfirmModal);
refreshConfirmClose?.addEventListener('click', closeRefreshConfirmModal);
refreshConfirmModal?.addEventListener('click', (event) => {
  if (event.target === refreshConfirmModal) closeRefreshConfirmModal();
});

refreshProgressClose?.addEventListener('click', () => {
  if (refreshOwner) return;
  closeRefreshProgressModal();
});
refreshProgressModal?.addEventListener('click', (event) => {
  if (event.target === refreshProgressModal && !refreshOwner) closeRefreshProgressModal();
});

privacyCancelButton?.addEventListener('click', closePrivacyModal);
privacyModal?.addEventListener('click', (event) => {
  if (event.target === privacyModal) closePrivacyModal();
});

// Button handlers
roomTagButton?.addEventListener('click', openOptionsModal);
trendingButton?.addEventListener('click', () => {
  closeSearchModal();
  if (isModalOpen(trendingPopover)) {
    closeTrendingPopover();
    return;
  }
  fetchTrending();
});

refreshDatabaseButton?.addEventListener('click', () => {
  if (menu?.hasAttribute('open')) menu.removeAttribute('open');
  openRefreshConfirmModal();
});

aboutOpenButton?.addEventListener('click', () => {
  if (menu?.hasAttribute('open')) menu.removeAttribute('open');
  openAboutModal();
});

appVersionTag?.addEventListener('click', openAboutModal);

openOptionsButton?.addEventListener('click', () => {
  if (menu?.hasAttribute('open')) menu.removeAttribute('open');
  openOptionsModal();
});

shareRoomButton?.addEventListener('click', openShareModal);

// Options handlers
optionCompact?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  settings.compact = target.checked;
  applyCompactSetting();
  saveSettings(settings);
});

defaultRoomSelect?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  settings.defaultRoom = target.value;
  saveSettings(settings);
});

// Share handlers
shareCopyButton?.addEventListener('click', async () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    shareModalMessage.textContent = 'Copied to clipboard!';
  } catch (error) {
    shareModalMessage.textContent = 'Copy failed. Select the URL manually.';
  }
});

shareEmailButton?.addEventListener('click', () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  window.open(`mailto:?subject=Shovo list&body=${encodeURIComponent(url)}`, '_blank');
});

shareWhatsAppButton?.addEventListener('click', () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
});

shareMessengerButton?.addEventListener('click', () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}`, '_blank');
});

shareTelegramButton?.addEventListener('click', () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, '_blank');
});

shareInstagramButton?.addEventListener('click', () => {
  const url = shareModal?.dataset.shareUrl;
  if (!url) return;
  shareModalMessage.textContent = "Instagram sharing isn't direct. Copy the link and share it in the app.";
});

// Privacy handlers
privacyUnlockButton?.addEventListener('click', () => {
  if (!privacyPasswordInput) return;
  const attempt = privacyPasswordInput.value.trim();
  if (attempt && attempt === getRoomPassword(settings, room)) {
    settings.rooms[room].authorized = true;
    saveSettings(settings);
    closePrivacyModal();
    loadList();
  } else {
    privacyError?.removeAttribute('hidden');
  }
});

privacyPasswordInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    privacyUnlockButton?.click();
  }
});

// Refresh handlers
refreshConfirmStart?.addEventListener('click', async () => {
  closeRefreshConfirmModal();
  refreshOwner = true;
  openRefreshProgressModal();
  updateRefreshProgress({ refreshing: true, processed: 0, total: 0 });
  try {
    await startRefresh(room);
    detailCache.clear();
    startRefreshPolling();
    pollRefreshStatus();
  } catch (error) {
    refreshOwner = false;
    closeRefreshProgressModal();
    if (error.message === 'Refresh already in progress') {
      alert('A database refresh is already in progress.');
      pollRefreshStatus();
      return;
    }
    alert('Unable to refresh database.');
  }
});

// Tab handlers
tabWatchlist.addEventListener('click', () => setActiveTab('unwatched'));
tabWatched.addEventListener('click', () => setActiveTab('watched'));

// Pagination handlers
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

// Escape key handler
setupEscapeHandler(
  {
    search: searchModal,
    trending: trendingPopover,
    image: imageModal,
    about: aboutModal,
    share: shareModal,
    privacy: privacyModal,
    options: optionsModal
  },
  {
    search: closeSearchModal,
    trending: closeTrendingPopover,
    image: closeImageModal,
    about: closeAboutModal,
    share: closeShareModal,
    privacy: closePrivacyModal,
    options: closeOptionsModal
  }
);

// Click outside to close search/trending
document.addEventListener('click', (event) => {
  const target = event.target;
  if (
    target instanceof Element &&
    (searchModal?.contains(target) ||
      trendingPopover?.contains(target) ||
      searchInput.contains(target) ||
      trendingButton?.contains(target))
  ) {
    return;
  }
  closeSearchModal();
  closeTrendingPopover();
});

// Initialize
initializeSettings();
applyShareToken();
updateRoomVisibilityBadge();
updateRoomCount();
loadList();
renderSearchResults([]);

// Setup mobile enhancements
setupMobileEnhancements(loadList, {
  setActiveTab: setActiveTab,
  activeTab: activeTab,
  onCardRemove: async (titleId) => {
    try {
      // Find the item in the current list
      const item = currentListItems.find(item => item.title_id === titleId);
      if (item) {
        await apiRemoveFromList(room, titleId);
        await loadList();
      }
    } catch (error) {
      alert('Failed to remove item.');
    }
  },
  onCardToggle: async (titleId) => {
    try {
      // Find the item in the current list
      const item = currentListItems.find(item => item.title_id === titleId);
      if (item) {
        await updateWatched(room, titleId, !item.watched);
        await loadList();
      }
    } catch (error) {
      alert('Failed to toggle item.');
    }
  }
});
