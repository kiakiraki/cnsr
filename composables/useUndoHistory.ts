import { shallowRef, computed } from 'vue'

export interface UndoEntry {
  imageData: ImageData
  x: number
  y: number
}

// Maximum number of edits that can be undone.
export const MAX_UNDO_LEVELS = 64

export interface UndoHistoryDeps {
  getCtx: () => CanvasRenderingContext2D | null
  getCanvas: () => HTMLCanvasElement | undefined
  setOriginalImageData: (data: ImageData | null) => void
}

/**
 * Owns the undo stack (a list of region-diff entries: an ImageData patch
 * plus the x/y position it was captured from) and the operations that
 * mutate it.
 *
 * The stack is a shallowRef so ImageData objects (which wrap a
 * Uint8ClampedArray) are never made deeply reactive - only replacing the
 * whole array (immutable updates) triggers reactivity. This fixes the
 * original bug where undoStack.push()/.pop()/.shift() mutated the array
 * in place and never triggered Vue's reactivity system.
 */
export function useUndoHistory(deps: UndoHistoryDeps) {
  const undoStack = shallowRef<UndoEntry[]>([])

  // Replaces the previous manually-synced `canUndo` ref (6 call sites in
  // the original component) with a derived value that can never drift.
  const canUndo = computed(() => undoStack.value.length > 0)

  const pushUndoEntry = (entry: UndoEntry) => {
    undoStack.value = [...undoStack.value, entry].slice(-MAX_UNDO_LEVELS)
  }

  const popUndoEntry = (): UndoEntry | undefined => {
    const stack = undoStack.value
    if (stack.length === 0) return undefined
    const entry = stack[stack.length - 1]
    undoStack.value = stack.slice(0, -1)
    return entry
  }

  const clearUndoHistory = () => {
    undoStack.value = []
  }

  /**
   * Restores the most recent undo entry onto the canvas and refreshes the
   * cached "original" image data. Returns true if an entry was restored,
   * false if there was nothing to undo (or no rendering context yet).
   */
  const undoLastAction = (): boolean => {
    const ctx = deps.getCtx()
    if (!ctx || undoStack.value.length === 0) return false

    const entry = popUndoEntry()!
    ctx.putImageData(entry.imageData, entry.x, entry.y)

    const canvasEl = deps.getCanvas()
    if (canvasEl) {
      deps.setOriginalImageData(
        ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
      )
    }

    return true
  }

  return {
    undoStack,
    canUndo,
    pushUndoEntry,
    popUndoEntry,
    clearUndoHistory,
    undoLastAction,
  }
}
