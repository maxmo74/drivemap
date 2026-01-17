/**
 * Modal management module for Shovo
 */

/**
 * Open a modal
 * @param {HTMLElement} modal - Modal element
 */
export function openModal(modal) {
  if (!modal) return;
  modal.classList.add('is-visible');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Close a modal
 * @param {HTMLElement} modal - Modal element
 */
export function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('is-visible');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Check if a modal is open
 * @param {HTMLElement} modal - Modal element
 * @returns {boolean}
 */
export function isModalOpen(modal) {
  return modal?.classList.contains('is-visible') || false;
}

/**
 * Get large image URL from thumbnail
 * @param {string} url - Thumbnail URL
 * @returns {string} - Large image URL
 */
export function getLargeImage(url) {
  if (!url) {
    return 'https://via.placeholder.com/500x750?text=No+Image';
  }
  if (url.includes('._V1_')) {
    return url.replace(/_UX\d+_CR0,0,\d+,\d+_AL_/i, '_UX500_CR0,0,500,750_AL_');
  }
  return url;
}

/**
 * Create modal handlers for a specific modal
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLElement} closeButton - Close button element
 * @returns {object} - Handler functions
 */
export function createModalHandlers(modal, closeButton) {
  const open = () => openModal(modal);
  const close = () => closeModal(modal);

  // Close on button click
  if (closeButton) {
    closeButton.addEventListener('click', close);
  }

  // Close on backdrop click
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        close();
      }
    });
  }

  return { open, close, isOpen: () => isModalOpen(modal) };
}

/**
 * Setup escape key handler for modals
 * @param {object} modals - Object mapping names to modal elements
 * @param {object} handlers - Object mapping names to close handlers
 */
export function setupEscapeHandler(modals, handlers) {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    for (const [name, modal] of Object.entries(modals)) {
      if (isModalOpen(modal) && handlers[name]) {
        handlers[name]();
        break;
      }
    }
  });
}
