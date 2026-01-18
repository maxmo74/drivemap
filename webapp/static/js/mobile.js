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
 * Handle swipe gesture
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
  }

  setupOrientationHandler();
  setupResizeHandler();
}
