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

  // Swipe gestures can be used for tab navigation in the future
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

  document.addEventListener(
    'touchstart',
    (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 80 && loadListCallback) {
        isPulling = false;
        loadListCallback();
      }
    },
    { passive: true }
  );

  document.addEventListener('touchend', () => {
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
 */
export function setupMobileEnhancements(loadList) {
  loadListCallback = loadList;

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
