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
let pendingDrag = null;

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
function startDrag(targetCard, event, dragHandle) {
  if (!targetCard || draggingCard) return;
  draggingCard = targetCard;
  draggingPointerId = event.pointerId;
  dragOriginRect = targetCard.getBoundingClientRect();
  draggingStartY = event.clientY;
  draggingOffsetY = 0;
  activeDragHandle = dragHandle;
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
  if (activeDragHandle?.setPointerCapture) {
    activeDragHandle.setPointerCapture(event.pointerId);
  }
  document.addEventListener('pointermove', onPointerDragMove, { passive: false });
  document.addEventListener('pointerup', onPointerDragPointerUp);
  document.addEventListener('pointercancel', onPointerDragPointerCancel);
  event.preventDefault();
}

function handleDragHandlePointerDown(event) {
  const targetCard = event.currentTarget.closest('.card');
  if (!targetCard) return;
  if (draggingCard) {
    stopPointerDragListeners();
  }
  startDrag(targetCard, event, event.currentTarget);
}

function handleCardPointerDown(event) {
  const targetCard = event.currentTarget.closest('.card');
  if (!targetCard || draggingCard) return;
  if (event.pointerType === 'mouse') return;
  pendingDrag = {
    card: targetCard,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startTime: event.timeStamp
  };
  document.addEventListener('pointermove', onPendingPointerMove, { passive: false });
  document.addEventListener('pointerup', onPendingPointerUp);
  document.addEventListener('pointercancel', onPendingPointerCancel);
}

function onPendingPointerMove(event) {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
  const deltaX = Math.abs(event.clientX - pendingDrag.startX);
  const deltaY = Math.abs(event.clientY - pendingDrag.startY);
  if (deltaX < 6 && deltaY < 6) {
    return;
  }
  if (event.timeStamp - pendingDrag.startTime < 120) {
    clearPendingDragListeners();
    return;
  }
  const { card } = pendingDrag;
  clearPendingDragListeners();
  startDrag(card, event, card);
}

function onPendingPointerUp(event) {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
  clearPendingDragListeners();
}

function onPendingPointerCancel(event) {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
  clearPendingDragListeners();
}

function clearPendingDragListeners() {
  pendingDrag = null;
  document.removeEventListener('pointermove', onPendingPointerMove);
  document.removeEventListener('pointerup', onPendingPointerUp);
  document.removeEventListener('pointercancel', onPendingPointerCancel);
}

/**
 * Attach drag handlers to cards in a container
 * @param {HTMLElement} container - Container element
 * @param {Function} orderChangeCallback - Callback when order changes
 */
export function attachDragHandlers(container, orderChangeCallback, options = {}) {
  listContainer = container;
  onOrderChange = orderChangeCallback;
  const enableCardDrag = options.enableCardDrag;

  container.querySelectorAll('.card').forEach((card) => {
    card.querySelectorAll('.card-drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', handleDragHandlePointerDown);
    });
    if (enableCardDrag) {
      card.addEventListener('pointerdown', handleCardPointerDown);
    }
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
