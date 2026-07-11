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

const isTouchEvent = (event: MouseEvent | TouchEvent): event is TouchEvent =>
  'touches' in event

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
    if (now - lastUpdateTime < THROTTLE_INTERVAL_MS && animationFrameId) return

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

  // -- Keyboard-driven selection (WCAG 2.1.1 keyboard operability) --
  // Operates on the same `selection`/`hasSelection` state as pointer-based
  // drag selection above, so the two interaction modes never desync - only
  // whichever one last moved the rectangle is reflected on screen.

  /** Fraction of the image's short side moved per arrow-key press. */
  const KEYBOARD_MOVE_STEP_FRACTION = 0.02
  /** Fraction used instead while Ctrl/Cmd is held (faster move/resize). */
  const KEYBOARD_MOVE_STEP_ACCELERATED_FRACTION = 0.1
  /** Fraction of the image's short side used for a freshly keyboard-created selection. */
  const KEYBOARD_INITIAL_SIZE_FRACTION = 0.25
  /** A keyboard resize can never shrink the selection below this many canvas px. */
  const KEYBOARD_MIN_SELECTION_PX = 10

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max)

  /** Actual (unscaled) pixel dimensions of the loaded image, read off the
   * canvas element itself (set by useCanvasRenderer.loadImageToCanvas). */
  const getImageSize = () => {
    const canvasEl = deps.canvas.value
    if (!canvasEl || !canvasEl.width || !canvasEl.height) return null
    return { width: canvasEl.width, height: canvasEl.height }
  }

  /** Sorts start/end so startX<=endX and startY<=endY. Keyboard interactions
   * always operate on a normalized rectangle, unlike drag selection (which
   * keeps raw start/end so it can grow in any direction from the initial
   * mousedown point). */
  const normalizeSelection = () => {
    const s = selection.value
    const startX = Math.min(s.startX, s.endX)
    const endX = Math.max(s.startX, s.endX)
    const startY = Math.min(s.startY, s.endY)
    const endY = Math.max(s.startY, s.endY)
    selection.value = { startX, startY, endX, endY, active: true }
  }

  /** Ensures there's an active, normalized selection to operate the
   * keyboard on - creating a centered default-sized one (short side / 4)
   * when none exists yet (e.g. nothing was drag-selected first). */
  const ensureKeyboardSelection = () => {
    const size = getImageSize()
    if (!size) return false

    if (!selection.value.active) {
      const shortSide = Math.min(size.width, size.height)
      const boxSize = shortSide * KEYBOARD_INITIAL_SIZE_FRACTION
      const centerX = size.width / 2
      const centerY = size.height / 2
      selection.value = {
        startX: centerX - boxSize / 2,
        startY: centerY - boxSize / 2,
        endX: centerX + boxSize / 2,
        endY: centerY + boxSize / 2,
        active: true,
      }
    } else {
      normalizeSelection()
    }
    return true
  }

  const getKeyboardStep = (
    size: { width: number; height: number },
    accelerate: boolean
  ) => {
    const shortSide = Math.min(size.width, size.height)
    const fraction = accelerate
      ? KEYBOARD_MOVE_STEP_ACCELERATED_FRACTION
      : KEYBOARD_MOVE_STEP_FRACTION
    return Math.max(1, shortSide * fraction)
  }

  /** Moves the whole selection rectangle by (dx, dy) steps, clamped so it
   * never leaves the image bounds. */
  const moveSelectionByKeyboard = (
    dx: number,
    dy: number,
    accelerate: boolean
  ) => {
    const size = getImageSize()
    if (!size || !ensureKeyboardSelection()) return

    const step = getKeyboardStep(size, accelerate)
    const s = selection.value
    const width = s.endX - s.startX
    const height = s.endY - s.startY

    const startX = clamp(s.startX + dx * step, 0, size.width - width)
    const startY = clamp(s.startY + dy * step, 0, size.height - height)

    selection.value = {
      startX,
      startY,
      endX: startX + width,
      endY: startY + height,
      active: true,
    }
    deps.redrawCanvas(selection.value, true)
  }

  /** Resizes the selection from its bottom-right corner by (dWidth, dHeight)
   * steps, clamped to the image bounds and a minimum selection size. */
  const resizeSelectionByKeyboard = (
    dWidth: number,
    dHeight: number,
    accelerate: boolean
  ) => {
    const size = getImageSize()
    if (!size || !ensureKeyboardSelection()) return

    const step = getKeyboardStep(size, accelerate)
    const s = selection.value

    const endX = clamp(
      s.endX + dWidth * step,
      s.startX + KEYBOARD_MIN_SELECTION_PX,
      size.width
    )
    const endY = clamp(
      s.endY + dHeight * step,
      s.startY + KEYBOARD_MIN_SELECTION_PX,
      size.height
    )

    selection.value = { ...s, endX, endY, active: true }
    deps.redrawCanvas(selection.value, true)
  }

  /** Confirms the current keyboard selection - same apply flow as a
   * pointer-drag ending with a valid size (via deps.onSelectionEnd). */
  const confirmKeyboardSelection = () => {
    if (!selection.value.active) return
    normalizeSelection()
    const s = selection.value
    hasSelection.value =
      s.endX - s.startX > SELECTION_MIN_SIZE_PX &&
      s.endY - s.startY > SELECTION_MIN_SIZE_PX

    if (hasSelection.value) {
      deps.onSelectionEnd?.(s)
    }
  }

  /** Cancels the current keyboard selection, clearing the overlay. */
  const cancelKeyboardSelection = () => {
    clearSelectionState()
  }

  const ARROW_KEY_DELTAS: Record<string, { dx: number; dy: number }> = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
  }

  /** Full keydown handler meant to be wired directly onto the canvas
   * element's @keydown. Arrow keys move the selection (creating a centered
   * default one first if needed); Shift+arrow resizes it; Ctrl/Cmd
   * accelerates either; Enter confirms/applies; Escape cancels. */
  const handleCanvasKeyDown = (event: KeyboardEvent) => {
    const delta = ARROW_KEY_DELTAS[event.key]
    if (delta) {
      event.preventDefault()
      const accelerate = event.ctrlKey || event.metaKey
      if (event.shiftKey) {
        resizeSelectionByKeyboard(delta.dx, delta.dy, accelerate)
      } else {
        moveSelectionByKeyboard(delta.dx, delta.dy, accelerate)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      confirmKeyboardSelection()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelKeyboardSelection()
    }
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
    moveSelectionByKeyboard,
    resizeSelectionByKeyboard,
    confirmKeyboardSelection,
    cancelKeyboardSelection,
    handleCanvasKeyDown,
  }
}
