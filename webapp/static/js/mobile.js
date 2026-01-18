/**
 * Mobile enhancements module for Shovo
 */

let loadListCallback = null;

/**
 * Check if device is mobile
 * @returns {boolean}
 */
export function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Check if device supports touch
 * @returns {boolean}
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Setup mobile-specific event listeners
 */
function setupMobileEventListeners() {
  // Improve modal behavior on mobile
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach((modal) => {
    modal.addEventListener(
      'touchmove',
      (e) => {
        if (modal.classList.contains('is-visible')) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  });
}

/**
 * Setup touch feedback on buttons
 */
function setupTouchFeedback() {
  const buttons = document.querySelectorAll('button, .card-action, .tab, .icon-button');
  buttons.forEach((button) => {
    button.addEventListener(
      'touchstart',
      function () {
        this.classList.add('active-touch');
      },
      { passive: true }
    );

    button.addEventListener(
      'touchend',
      function () {
        this.classList.remove('active-touch');
      },
      { passive: true }
    );

    button.addEventListener(
      'touchcancel',
      function () {
        this.classList.remove('active-touch');
      },
      { passive: true }
    );
  });
}

/**
 * Setup swipe gestures
 */
function setupSwipeGestures() {
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeGesture(touchStartX, touchEndX);
    },
    { passive: true }
  );
}

/**
 * Handle swipe gesture for tab navigation
 * @param {number} startX - Start X position
 * @param {number} endX - End X position
 */
function handleSwipeGesture(startX, endX) {
  const swipeThreshold = 50;
  const swipeDistance = startX - endX;

  if (Math.abs(swipeDistance) < swipeThreshold) return;

  // Use global variables for tab navigation
  const currentTab = window.mobileActiveTab || 'unwatched';
  const setActiveTab = window.mobileSetActiveTab;

  if (!setActiveTab) return;

  // Swipe left to right (right swipe) - navigate to previous tab
  if (swipeDistance > swipeThreshold) {
    if (currentTab === 'watched') {
      setActiveTab('unwatched');
    }
  }
  // Swipe right to left (left swipe) - navigate to next tab
  else if (swipeDistance < -swipeThreshold) {
    if (currentTab === 'unwatched') {
      setActiveTab('watched');
    }
  }
}

// Export card swipe setup function for direct use
export function setupCardSwipeGestures(onRemove, onToggle) {
  setupCardSwipeGestures(onRemove, onToggle);
}

/**
 * Setup swipe gestures for individual cards
 * @param {Function} onRemove - Callback for remove action
 * @param {Function} onToggle - Callback for toggle action
 */
function setupCardSwipeGestures(onRemove, onToggle) {
  const cards = document.querySelectorAll('.card');
  let touchStartX = 0;
  let touchStartY = 0;
  let currentCard = null;
  let isSwiping = false;
  let swipeDirection = null;

  cards.forEach(card => {
    // Skip setup if already configured
    if (card.dataset.swipeSetup) return;
    card.dataset.swipeSetup = 'true';

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      currentCard = card;
      isSwiping = false;
      swipeDirection = null;
      
      // Store initial position
      card.dataset.startX = touchStartX;
      card.dataset.startY = touchStartY;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!currentCard || !touchStartX) return;
      
      const touchCurrentX = e.touches[0].clientX;
      const touchCurrentY = e.touches[0].clientY;
      const deltaX = touchCurrentX - touchStartX;
      const deltaY = touchCurrentY - touchStartY;

      // Only consider horizontal swipes
      if (Math.abs(deltaX) < Math.abs(deltaY)) {
        isSwiping = false;
        return;
      }

      // Determine swipe direction
      if (Math.abs(deltaX) > 10) {
        isSwiping = true;
        swipeDirection = deltaX > 0 ? 'right' : 'left';
        
        // Visual feedback
        if (swipeDirection === 'left') {
          card.style.transform = `translateX(${deltaX}px)`;
          card.style.opacity = Math.max(0.5, 1 - Math.abs(deltaX) / 100);
        } else if (swipeDirection === 'right') {
          card.style.transform = `translateX(${deltaX}px)`;
          card.style.opacity = Math.max(0.5, 1 - Math.abs(deltaX) / 100);
        }
      }
    }, { passive: false });

    card.addEventListener('touchend', (e) => {
      if (!currentCard || !isSwiping || !swipeDirection) {
        // Reset state
        if (currentCard) {
          currentCard.style.transform = '';
          currentCard.style.opacity = '';
        }
        currentCard = null;
        touchStartX = 0;
        touchStartY = 0;
        isSwiping = false;
        swipeDirection = null;
        return;
      }

      const touchEndX = e.changedTouches[0].clientX;
      const swipeDistance = touchEndX - touchStartX;
      const swipeThreshold = 80; // Require larger swipe for action

      // Reset visual state
      currentCard.style.transform = '';
      currentCard.style.opacity = '';

      // Determine which list we're in
      const activeTab = document.querySelector('.tab.active');
      const isWatchlist = activeTab && activeTab.id === 'tab-watchlist';
      const isWatched = activeTab && activeTab.id === 'tab-watched';

      // Handle swipe actions
      if (Math.abs(swipeDistance) >= swipeThreshold) {
        if (swipeDirection === 'left') {
          // Left swipe - remove from current list
          if (onRemove) {
            const titleId = currentCard.dataset.titleId;
            onRemove(titleId);
          }
        } else if (swipeDirection === 'right') {
          // Right swipe - toggle between watchlist/watched
          if (onToggle) {
            const titleId = currentCard.dataset.titleId;
            const currentStatus = isWatchlist ? 'watchlist' : 'watched';
            const newStatus = currentStatus === 'watchlist' ? 'watched' : 'watchlist';
            onToggle(titleId, newStatus);
          }
        }
      }

      // Reset state
      currentCard = null;
      touchStartX = 0;
      touchStartY = 0;
      isSwiping = false;
      swipeDirection = null;
    }, { passive: true });
  });
}

/**
 * Setup double-tap prevention
 */
function setupDoubleTapPrevention() {
  document.addEventListener('dblclick', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
}

/**
 * Setup pull-to-refresh
 */
function setupPullToRefresh() {
  let startY = 0;
  let isPulling = false;
  let pullDistance = 0;
  const pullThreshold = 100;
  const pullElement = document.createElement('div');
  pullElement.className = 'pull-to-refresh';
  pullElement.textContent = '🔄 Pull to refresh';
  pullElement.style.position = 'fixed';
  pullElement.style.top = '-50px';
  pullElement.style.left = '0';
  pullElement.style.width = '100%';
  pullElement.style.textAlign = 'center';
  pullElement.style.padding = '10px';
  pullElement.style.background = 'var(--surface-strong)';
  pullElement.style.color = 'var(--text-soft)';
  pullElement.style.transition = 'top 0.2s ease';
  pullElement.style.zIndex = '1000';
  pullElement.style.fontSize = '0.8rem';
  document.body.appendChild(pullElement);

  document.addEventListener(
    'touchstart',
    (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
        pullDistance = 0;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      pullDistance = currentY - startY;

      if (pullDistance > 0) {
        e.preventDefault(); // Prevent scrolling while pulling
        const progress = Math.min(pullDistance / pullThreshold, 1);
        pullElement.textContent = pullDistance >= pullThreshold ? '🔄 Release to refresh' : '🔄 Pull to refresh';
        pullElement.style.top = `${Math.min(pullDistance - 50, 50)}px`;
      }
    },
    { passive: false }
  );

  document.addEventListener('touchend', () => {
    if (isPulling && pullDistance >= pullThreshold && loadListCallback) {
      pullElement.textContent = '🔄 Refreshing...';
      pullElement.style.top = '0';
      setTimeout(() => {
        loadListCallback();
        setTimeout(() => {
          pullElement.style.top = '-50px';
        }, 500);
      }, 300);
    } else {
      pullElement.style.top = '-50px';
    }
    isPulling = false;
  });
}

/**
 * Setup orientation change handler
 */
function setupOrientationHandler() {
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (loadListCallback) {
        loadListCallback();
      }
    }, 300);
  });
}

/**
 * Setup resize handler
 */
function setupResizeHandler() {
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (isMobile()) {
        document.body.classList.add('is-mobile');
      } else {
        document.body.classList.remove('is-mobile');
      }
    }, 200);
  });
}

/**
 * Initialize mobile enhancements
 * @param {Function} loadList - Callback to reload list
 * @param {Object} options - Additional options
 * @param {Function} options.setActiveTab - Function to set active tab
 * @param {string} options.activeTab - Current active tab
 */
export function setupMobileEnhancements(loadList, options = {}) {
  loadListCallback = loadList;

  if (options.setActiveTab) {
    window.mobileSetActiveTab = options.setActiveTab;
  }
  if (options.activeTab) {
    window.mobileActiveTab = options.activeTab;
  }

  if (isMobile() || isTouchDevice()) {
    document.body.classList.add('is-mobile');
    setupTouchFeedback();
    setupSwipeGestures();
    setupDoubleTapPrevention();
    setupPullToRefresh();
    setupMobileEventListeners();
    
    // Setup card swipe gestures if callbacks are provided
    if (options.onCardRemove || options.onCardToggle) {
      setupCardSwipeGestures(options.onCardRemove, options.onCardToggle);
    }
  }

  setupOrientationHandler();
  setupResizeHandler();
}
