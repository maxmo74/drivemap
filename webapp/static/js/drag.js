/**
 * Drag and drop module for Shovo
 */

let draggingCard = null;
let draggingPointerId = null;
let draggingStartY = 0;
let draggingOffsetY = 0;
let activeDragHandle = null;
let dragPlaceholder = null;
let dragOriginRect = null;
let listContainer = null;
let onOrderChange = null;

/**
 * Get the element to insert after based on Y position
 * @param {HTMLElement} container - Container element
 * @param {number} y - Y position
 * @returns {HTMLElement|null} - Element to insert after
 */
function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.card:not(.dragging):not(.drag-placeholder)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  cards.forEach((card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: card };
    }
  });
  return closest.element;
}

/**
 * Handle pointer move during drag
 * @param {PointerEvent} event - Pointer event
 */
function onPointerDragMove(event) {
  if (!draggingCard || event.pointerId !== draggingPointerId) return;
  event.preventDefault();
  draggingOffsetY = event.clientY - draggingStartY;
  draggingCard.style.transform = `translateY(${draggingOffsetY}px)`;
  const afterElement = getDragAfterElement(listContainer, event.clientY);
  if (!dragPlaceholder) return;
  if (!afterElement) {
    listContainer.appendChild(dragPlaceholder);
    return;
  }
  listContainer.insertBefore(dragPlaceholder, afterElement);
}

/**
 * Handle pointer up during drag
 * @param {PointerEvent} event - Pointer event
 */
function onPointerDragPointerUp(event) {
  if (draggingPointerId !== event.pointerId) return;
  stopPointerDragListeners();
  onPointerDragEnd();
}

/**
 * Handle pointer cancel during drag
 * @param {PointerEvent} event - Pointer event
 */
function onPointerDragPointerCancel(event) {
  if (draggingPointerId !== event.pointerId) return;
  stopPointerDragListeners();
  onPointerDragEnd();
}

/**
 * Stop pointer drag listeners
 */
function stopPointerDragListeners() {
  if (!activeDragHandle || draggingPointerId === null) return;
  activeDragHandle.releasePointerCapture(draggingPointerId);
  document.removeEventListener('pointermove', onPointerDragMove);
  document.removeEventListener('pointerup', onPointerDragPointerUp);
  document.removeEventListener('pointercancel', onPointerDragPointerCancel);
  activeDragHandle = null;
}

/**
 * Handle drag end
 */
async function onPointerDragEnd() {
  if (!draggingCard) return;
  listContainer.querySelectorAll('.card').forEach((card) => {
    card.style.transform = '';
  });
  draggingCard.style.transform = '';
  draggingCard.style.position = '';
  draggingCard.style.left = '';
  draggingCard.style.top = '';
  draggingCard.style.width = '';
  draggingCard.classList.remove('dragging');
  if (dragPlaceholder) {
    listContainer.insertBefore(draggingCard, dragPlaceholder);
    dragPlaceholder.remove();
    dragPlaceholder = null;
  }
  draggingCard = null;
  draggingPointerId = null;
  draggingStartY = 0;
  draggingOffsetY = 0;
  dragOriginRect = null;
  listContainer.classList.remove('is-dragging');
  if (onOrderChange) {
    await onOrderChange();
  }
}

/**
 * Handle pointer down on drag handle
 * @param {PointerEvent} event - Pointer event
 */
function handleDragHandlePointerDown(event) {
  const targetCard = event.currentTarget.closest('.card');
  if (!targetCard) return;
  if (draggingCard) {
    stopPointerDragListeners();
  }
  draggingCard = targetCard;
  draggingPointerId = event.pointerId;
  dragOriginRect = targetCard.getBoundingClientRect();
  draggingStartY = event.clientY;
  draggingOffsetY = 0;
  activeDragHandle = event.currentTarget;
  listContainer.classList.add('is-dragging');
  targetCard.classList.add('dragging');
  dragPlaceholder = document.createElement('div');
  dragPlaceholder.className = 'card drag-placeholder';
  dragPlaceholder.style.height = `${dragOriginRect.height}px`;
  dragPlaceholder.style.width = `${dragOriginRect.width}px`;
  listContainer.insertBefore(dragPlaceholder, targetCard.nextSibling);
  listContainer.classList.add('is-dragging');
  targetCard.style.position = 'fixed';
  targetCard.style.left = `${dragOriginRect.left}px`;
  targetCard.style.top = `${dragOriginRect.top}px`;
  targetCard.style.width = `${dragOriginRect.width}px`;
  event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener('pointermove', onPointerDragMove, { passive: false });
  document.addEventListener('pointerup', onPointerDragPointerUp);
  document.addEventListener('pointercancel', onPointerDragPointerCancel);
  event.preventDefault();
}

/**
 * Attach drag handlers to cards in a container
 * @param {HTMLElement} container - Container element
 * @param {Function} orderChangeCallback - Callback when order changes
 */
export function attachDragHandlers(container, orderChangeCallback) {
  listContainer = container;
  onOrderChange = orderChangeCallback;

  container.querySelectorAll('.card').forEach((card) => {
    card.querySelectorAll('.card-drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', handleDragHandlePointerDown);
    });
  });
}

/**
 * Get current order of title IDs
 * @param {HTMLElement} container - Container element
 * @returns {string[]} - Array of title IDs
 */
export function getCurrentOrder(container) {
  return Array.from(container.querySelectorAll('.card')).map((card) => card.dataset.titleId);
}
