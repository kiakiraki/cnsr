import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  useAreaSelection,
  SELECTION_MIN_SIZE_PX,
  type UseAreaSelectionDeps,
} from '../composables/useAreaSelection'

// Keyboard-driven selection: arrow keys move/create the selection,
// Shift+arrow resizes it, Ctrl/Cmd accelerates either, Enter confirms
// (applying the same onSelectionEnd flow as a mouse drag), Escape cancels.
describe('Keyboard Selection', () => {
  let deps: UseAreaSelectionDeps

  const arrowKey = (
    key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
    init: KeyboardEventInit = {}
  ) => new KeyboardEvent('keydown', { key, cancelable: true, ...init })

  const enterKey = () =>
    new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })

  const escapeKey = () =>
    new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })

  beforeEach(() => {
    deps = {
      // 800x600 canvas -> short side 600, so a fresh keyboard selection is
      // centered with a 150x150 box (600 * 0.25), and a plain arrow-key
      // step is 12px (600 * 0.02) / an accelerated one is 60px (600 * 0.1).
      canvas: ref({ width: 800, height: 600 } as HTMLCanvasElement),
      updateCanvasMetrics: vi.fn(),
      getCanvasRect: () => null,
      getScale: () => ({ scaleX: 1, scaleY: 1 }),
      redrawCanvas: vi.fn(),
      clearOverlay: vi.fn(),
      onSelectionEnd: vi.fn(),
    }
  })

  describe('creating a selection', () => {
    it('creates a centered default-sized selection on the first arrow key press', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))

      // Default box is 150x150, centered at (400, 300), then nudged right
      // by one 12px step.
      expect(areaSelection.selection.value.active).toBe(true)
      expect(areaSelection.selection.value.startX).toBeCloseTo(325 + 12)
      expect(areaSelection.selection.value.startY).toBeCloseTo(225)
      expect(areaSelection.selection.value.endX).toBeCloseTo(475 + 12)
      expect(areaSelection.selection.value.endY).toBeCloseTo(375)
    })

    it('draws the selection onto the overlay via redrawCanvas', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowDown'))

      expect(deps.redrawCanvas).toHaveBeenCalledWith(
        areaSelection.selection.value,
        true
      )
    })

    it('does nothing if the canvas has no image loaded yet (zero size)', () => {
      deps.canvas = ref({ width: 0, height: 0 } as HTMLCanvasElement)
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))

      expect(areaSelection.selection.value.active).toBe(false)
      expect(deps.redrawCanvas).not.toHaveBeenCalled()
    })
  })

  describe('moving an existing selection', () => {
    it('moves the selection right by one step with ArrowRight', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight')) // create + move once
      const afterFirst = { ...areaSelection.selection.value }

      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))

      expect(areaSelection.selection.value.startX).toBeCloseTo(
        afterFirst.startX + 12
      )
      expect(areaSelection.selection.value.startY).toBeCloseTo(
        afterFirst.startY
      )
    })

    it('moves faster when Ctrl is held', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight')) // create it first
      const before = { ...areaSelection.selection.value }

      areaSelection.handleCanvasKeyDown(
        arrowKey('ArrowRight', { ctrlKey: true })
      )

      expect(areaSelection.selection.value.startX).toBeCloseTo(
        before.startX + 60
      )
    })

    it('preserves selection width/height while moving', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowDown'))
      const before = areaSelection.selection.value
      const width = before.endX - before.startX
      const height = before.endY - before.startY

      areaSelection.handleCanvasKeyDown(arrowKey('ArrowLeft'))
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowUp'))

      const after = areaSelection.selection.value
      expect(after.endX - after.startX).toBeCloseTo(width)
      expect(after.endY - after.startY).toBeCloseTo(height)
    })

    it('clamps movement so the selection never leaves the canvas bounds', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowLeft'))
      // Push far past the left edge.
      for (let i = 0; i < 100; i++) {
        areaSelection.handleCanvasKeyDown(arrowKey('ArrowLeft'))
      }

      expect(areaSelection.selection.value.startX).toBeCloseTo(0)

      for (let i = 0; i < 200; i++) {
        areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))
      }
      expect(areaSelection.selection.value.endX).toBeCloseTo(800)
    })
  })

  describe('resizing with Shift+Arrow', () => {
    it('grows the selection to the right with Shift+ArrowRight', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight')) // create default selection
      const before = areaSelection.selection.value.endX

      areaSelection.handleCanvasKeyDown(
        arrowKey('ArrowRight', { shiftKey: true })
      )

      expect(areaSelection.selection.value.endX).toBeCloseTo(before + 12)
    })

    it('shrinks the selection with Shift+ArrowLeft but not below the minimum size', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight')) // create default selection

      for (let i = 0; i < 100; i++) {
        areaSelection.handleCanvasKeyDown(
          arrowKey('ArrowLeft', { shiftKey: true })
        )
      }

      const s = areaSelection.selection.value
      expect(s.endX - s.startX).toBeCloseTo(10) // KEYBOARD_MIN_SELECTION_PX
    })

    it('resizes faster when Ctrl is held', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowDown')) // create default selection
      const before = areaSelection.selection.value.endY

      areaSelection.handleCanvasKeyDown(
        arrowKey('ArrowDown', { shiftKey: true, ctrlKey: true })
      )

      expect(areaSelection.selection.value.endY).toBeCloseTo(before + 60)
    })
  })

  describe('confirming with Enter', () => {
    it('applies the selection via onSelectionEnd, same as a mouse drag', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))
      areaSelection.handleCanvasKeyDown(enterKey())

      expect(deps.onSelectionEnd).toHaveBeenCalledTimes(1)
      expect(deps.onSelectionEnd).toHaveBeenCalledWith(
        areaSelection.selection.value
      )
      expect(areaSelection.hasSelection.value).toBe(true)
    })

    it('does not call onSelectionEnd if there is no active selection', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(enterKey())

      expect(deps.onSelectionEnd).not.toHaveBeenCalled()
    })

    it('exposes the same minimum size threshold as pointer selection', () => {
      expect(SELECTION_MIN_SIZE_PX).toBe(5)
    })
  })

  describe('cancelling with Escape', () => {
    it('clears the selection state and the overlay', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(arrowKey('ArrowRight'))

      areaSelection.handleCanvasKeyDown(escapeKey())

      expect(areaSelection.selection.value.active).toBe(false)
      expect(areaSelection.hasSelection.value).toBe(false)
      expect(deps.clearOverlay).toHaveBeenCalled()
    })
  })

  describe('key handling hygiene', () => {
    it('prevents default on handled keys so the page does not scroll', () => {
      const areaSelection = useAreaSelection(deps)
      const event = arrowKey('ArrowDown')
      const spy = vi.spyOn(event, 'preventDefault')

      areaSelection.handleCanvasKeyDown(event)

      expect(spy).toHaveBeenCalled()
    })

    it('ignores unrelated keys without touching the selection', () => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.handleCanvasKeyDown(
        new KeyboardEvent('keydown', { key: 'Tab' })
      )

      expect(areaSelection.selection.value.active).toBe(false)
      expect(deps.redrawCanvas).not.toHaveBeenCalled()
    })
  })
})
