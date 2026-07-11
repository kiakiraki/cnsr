import { ref, onUnmounted, type Ref } from 'vue'

export interface SelectionArea {
  startX: number
  startY: number
  endX: number
  endY: number
  active: boolean
}

// A drag shorter than this (in canvas px) on either axis is treated as a
// non-selection (e.g. an accidental click).
export const SELECTION_MIN_SIZE_PX = 5

// Selection updates are throttled to roughly this interval (60fps) and
// coalesced onto a single animation frame.
const THROTTLE_INTERVAL_MS = 16

export interface UseAreaSelectionDeps {
  canvas: Ref<HTMLCanvasElement | undefined>
  updateCanvasMetrics: () => void
  getCanvasRect: () => DOMRect | null
  getScale: () => { scaleX: number; scaleY: number }
  redrawCanvas: (selection: SelectionArea, isSelecting: boolean) => void
  /** Clears any selection rectangle left drawn (on the overlay canvas). */
  clearOverlay?: () => void
  /** Invoked with the final selection once a drag ends with a valid size. */
  onSelectionEnd?: (selection: SelectionArea) => void
}

const isTouchEvent = (
  event: MouseEvent | TouchEvent
): event is TouchEvent => 'touches' in event

export function useAreaSelection(deps: UseAreaSelectionDeps) {
  // `selection`/`hasSelection`/`isSelecting` are not read from the
  // template (the selection rectangle is drawn imperatively onto the
  // canvas via redrawCanvas), but are kept as refs - rather than plain
  // variables - so this composable's state stays directly testable and
  // consistent with the rest of the public API.
  const selection = ref<SelectionArea>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    active: false,
  })
  const hasSelection = ref(false)
  const isSelecting = ref(false)

  const getEventPosition = (event: MouseEvent | TouchEvent) => {
    // Update canvas metrics if not available or if it's a touch event
    // (which may have caused layout changes). Feature-detecting via
    // 'touches' in event avoids referencing the TouchEvent global, which
    // doesn't exist in every environment (e.g. some non-touch browsers).
    if (!deps.getCanvasRect() || isTouchEvent(event)) {
      deps.updateCanvasMetrics()
    }

    let clientX: number, clientY: number

    if (isTouchEvent(event)) {
      // For touch events, use the first touch point
      const touch = event.touches[0] || event.changedTouches[0]
      if (!touch) return null
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = event.clientX
      clientY = event.clientY
    }

    const rect = deps.getCanvasRect()
    if (!rect) return null
    const { scaleX, scaleY } = deps.getScale()

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!deps.canvas.value) return

    // Prevent selection on right-click
    if (!isTouchEvent(event) && event.button === 2) {
      return
    }

    // Ensure canvas metrics are fresh for mouse events at selection start
    if (!isTouchEvent(event)) {
      deps.updateCanvasMetrics()
    }

    const pos = getEventPosition(event)
    if (!pos) return
    selection.value = {
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
      active: true,
    }
    isSelecting.value = true
    hasSelection.value = false
  }

  // Throttling state for pointer-move updates during a drag.
  let lastUpdateTime = 0
  let animationFrameId: number | null = null

  const updateSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value || !deps.canvas.value) return

    const now = Date.now()
    if (now - lastUpdateTime < THROTTLE_INTERVAL_MS && animationFrameId)
      return

    lastUpdateTime = now

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }

    animationFrameId = requestAnimationFrame(() => {
      const pos = getEventPosition(event)
      if (pos) {
        selection.value.endX = pos.x
        selection.value.endY = pos.y
        deps.redrawCanvas(selection.value, isSelecting.value)
      }
      animationFrameId = null
    })
  }

  const endSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value) return

    isSelecting.value = false
    hasSelection.value =
      Math.abs(selection.value.endX - selection.value.startX) >
        SELECTION_MIN_SIZE_PX &&
      Math.abs(selection.value.endY - selection.value.startY) >
        SELECTION_MIN_SIZE_PX

    // Auto-apply processing if there's a valid selection
    if (hasSelection.value) {
      deps.onSelectionEnd?.(selection.value)
    }
  }

  /** Clears the transient selection state (used to be duplicated 4x). */
  const clearSelectionState = () => {
    selection.value.active = false
    hasSelection.value = false
    isSelecting.value = false
    deps.clearOverlay?.()
  }

  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  })

  return {
    selection,
    hasSelection,
    isSelecting,
    getEventPosition,
    startSelection,
    updateSelection,
    endSelection,
    clearSelectionState,
  }
}
