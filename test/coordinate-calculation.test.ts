import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  useAreaSelection,
  SELECTION_MIN_SIZE_PX,
  type UseAreaSelectionDeps,
} from '../composables/useAreaSelection'

describe('Coordinate Calculation', () => {
  let mockRect: DOMRect
  let scale: { scaleX: number; scaleY: number }
  let deps: UseAreaSelectionDeps

  beforeEach(() => {
    mockRect = {
      left: 10,
      top: 20,
      width: 400,
      height: 300,
      x: 10,
      y: 20,
      bottom: 320,
      right: 410,
      toJSON: () => ({}),
    }
    scale = { scaleX: 800 / 400, scaleY: 600 / 300 }

    deps = {
      canvas: ref({ width: 800, height: 600 } as HTMLCanvasElement),
      updateCanvasMetrics: vi.fn(),
      getCanvasRect: () => mockRect,
      getScale: () => scale,
      redrawCanvas: vi.fn(),
    }
  })

  describe('getEventPosition', () => {
    it('should calculate correct canvas coordinates for mouse events', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const mouseEvent = new MouseEvent('click', {
        clientX: 210, // 10 (rect.left) + 200 (offset)
        clientY: 170, // 20 (rect.top) + 150 (offset)
      })

      const result = getEventPosition(mouseEvent)

      // Expected: (200 / 400) * 800 = 400, (150 / 300) * 600 = 300
      expect(result?.x).toBe(400)
      expect(result?.y).toBe(300)
    })

    it('should calculate correct canvas coordinates for touch events', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const touchEvent = new TouchEvent('touchstart', {
        touches: [
          new Touch({
            identifier: 1,
            target: document.body,
            clientX: 110, // 10 (rect.left) + 100 (offset)
            clientY: 120, // 20 (rect.top) + 100 (offset)
          }),
        ],
      })

      const result = getEventPosition(touchEvent)

      // Expected: (100 / 400) * 800 = 200, (100 / 300) * 600 = 200
      expect(result?.x).toBe(200)
      expect(result?.y).toBe(200)
    })

    it('should refresh canvas metrics for touch events', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const touchEvent = new TouchEvent('touchstart', {
        touches: [
          new Touch({
            identifier: 1,
            target: document.body,
            clientX: 110,
            clientY: 120,
          }),
        ],
      })

      getEventPosition(touchEvent)

      // Touch events may follow layout changes, so metrics are always
      // refreshed - unlike mouse events, which reuse the cached rect.
      expect(deps.updateCanvasMetrics).toHaveBeenCalled()
    })

    it('should handle edge cases - top-left corner', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const mouseEvent = new MouseEvent('click', {
        clientX: 10, // rect.left
        clientY: 20, // rect.top
      })

      const result = getEventPosition(mouseEvent)

      expect(result?.x).toBe(0)
      expect(result?.y).toBe(0)
    })

    it('should handle edge cases - bottom-right corner', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const mouseEvent = new MouseEvent('click', {
        clientX: 410, // rect.left + rect.width
        clientY: 320, // rect.top + rect.height
      })

      const result = getEventPosition(mouseEvent)

      expect(result?.x).toBe(800)
      expect(result?.y).toBe(600)
    })

    it('should handle different scaling ratios', () => {
      // Different canvas/display size ratio
      scale = { scaleX: 1600 / 400, scaleY: 1200 / 300 }

      const { getEventPosition } = useAreaSelection(deps)
      const mouseEvent = new MouseEvent('click', {
        clientX: 210, // 10 (rect.left) + 200 (offset)
        clientY: 170, // 20 (rect.top) + 150 (offset)
      })

      const result = getEventPosition(mouseEvent)

      // Expected: (200 / 400) * 1600 = 800, (150 / 300) * 1200 = 600
      expect(result?.x).toBe(800)
      expect(result?.y).toBe(600)
    })

    it('should return null for a touch event with no touch points', () => {
      const { getEventPosition } = useAreaSelection(deps)
      const touchEvent = new TouchEvent('touchend', { touches: [] })

      expect(getEventPosition(touchEvent)).toBeNull()
    })
  })

  describe('Selection Area Normalization (via startSelection/updateSelection)', () => {
    // Directly drives the real startSelection/updateSelection pair (mouse
    // coordinates map 1:1 onto canvas coordinates here since scale is 1:1
    // relative to a rect positioned at the origin) and asserts the raw
    // (non-normalized) selection - normalization itself (min/abs) happens
    // downstream in useImageProcessing.applyMosaic when the edit is applied.
    beforeEach(() => {
      mockRect = {
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        bottom: 300,
        right: 400,
        toJSON: () => ({}),
      }
      scale = { scaleX: 1, scaleY: 1 }
      deps.getCanvasRect = () => mockRect
      deps.getScale = () => scale
    })

    const drag = (
      areaSelection: ReturnType<typeof useAreaSelection>,
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) => {
      areaSelection.startSelection(
        new MouseEvent('mousedown', { clientX: from.x, clientY: from.y })
      )
      // Bypass the throttled/rAF-based updateSelection and mutate directly,
      // matching what updateSelection would eventually assign.
      areaSelection.selection.value.endX = to.x
      areaSelection.selection.value.endY = to.y
    }

    it('should record selection when dragging right-down', () => {
      const areaSelection = useAreaSelection(deps)
      drag(areaSelection, { x: 100, y: 100 }, { x: 200, y: 200 })

      expect(areaSelection.selection.value.startX).toBe(100)
      expect(areaSelection.selection.value.startY).toBe(100)
      expect(areaSelection.selection.value.endX).toBe(200)
      expect(areaSelection.selection.value.endY).toBe(200)
    })

    it('should record selection when dragging left-up', () => {
      const areaSelection = useAreaSelection(deps)
      drag(areaSelection, { x: 200, y: 200 }, { x: 100, y: 100 })

      expect(areaSelection.selection.value.startX).toBe(200)
      expect(areaSelection.selection.value.startY).toBe(200)
      expect(areaSelection.selection.value.endX).toBe(100)
      expect(areaSelection.selection.value.endY).toBe(100)
    })
  })

  describe('Selection Validation (via endSelection)', () => {
    beforeEach(() => {
      mockRect = {
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        bottom: 300,
        right: 400,
        toJSON: () => ({}),
      }
      scale = { scaleX: 1, scaleY: 1 }
      deps.getCanvasRect = () => mockRect
      deps.getScale = () => scale
    })

    const dragAndEnd = (
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) => {
      const areaSelection = useAreaSelection(deps)
      areaSelection.startSelection(
        new MouseEvent('mousedown', { clientX: from.x, clientY: from.y })
      )
      areaSelection.selection.value.endX = to.x
      areaSelection.selection.value.endY = to.y
      areaSelection.endSelection(new MouseEvent('mouseup'))
      return areaSelection
    }

    it('should validate selection with sufficient size', () => {
      const areaSelection = dragAndEnd({ x: 100, y: 100 }, { x: 110, y: 110 })
      expect(areaSelection.hasSelection.value).toBe(true)
    })

    it('should invalidate selection with insufficient width', () => {
      const areaSelection = dragAndEnd({ x: 100, y: 100 }, { x: 104, y: 110 })
      expect(areaSelection.hasSelection.value).toBe(false)
    })

    it('should invalidate selection with insufficient height', () => {
      const areaSelection = dragAndEnd({ x: 100, y: 100 }, { x: 110, y: 104 })
      expect(areaSelection.hasSelection.value).toBe(false)
    })

    it('should invalidate selection with both dimensions too small', () => {
      const areaSelection = dragAndEnd({ x: 100, y: 100 }, { x: 103, y: 104 })
      expect(areaSelection.hasSelection.value).toBe(false)
    })

    it('should validate selection regardless of drag direction', () => {
      const areaSelection = dragAndEnd({ x: 110, y: 110 }, { x: 100, y: 100 })
      expect(areaSelection.hasSelection.value).toBe(true)
    })

    it('exposes the minimum size threshold as a named constant', () => {
      expect(SELECTION_MIN_SIZE_PX).toBe(5)
    })
  })
})
