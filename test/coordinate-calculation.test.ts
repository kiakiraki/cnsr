import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSelection } from '~/composables/useSelection'

describe('useSelection Composable', () => {
  let mockCanvas: {
    value: {
      width: number
      height: number
      getBoundingClientRect: () => DOMRect
    }
  }
  let mockRect: DOMRect

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

    mockCanvas = ref({
      width: 800,
      height: 600,
      getBoundingClientRect: vi.fn(() => mockRect),
    })
  })

  describe('getEventPosition (via startSelection)', () => {
    it('should calculate correct canvas coordinates for mouse events', () => {
      const { startSelection, selection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })

      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 210, // 10 (rect.left) + 200 (offset)
        clientY: 170, // 20 (rect.top) + 150 (offset)
      })

      startSelection(mouseEvent)

      // Expected: x = (200 / 400) * 800 = 400, y = (150 / 300) * 600 = 300
      expect(selection.value.startX).toBe(400)
      expect(selection.value.startY).toBe(300)
    })

    it('should calculate correct canvas coordinates for touch events', () => {
      const { startSelection, selection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })

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

      startSelection(touchEvent)

      // Expected: x = (100 / 400) * 800 = 200, y = (100 / 300) * 600 = 200
      expect(selection.value.startX).toBe(200)
      expect(selection.value.startY).toBe(200)
    })

    it('should handle edge cases - top-left corner', () => {
      const { startSelection, selection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })

      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 10, // rect.left
        clientY: 20, // rect.top
      })

      startSelection(mouseEvent)

      expect(selection.value.startX).toBe(0)
      expect(selection.value.startY).toBe(0)
    })

    it('should handle edge cases - bottom-right corner', async () => {
      const { startSelection, updateSelection, selection } = useSelection(
        mockCanvas,
        {
          onSelectionUpdate: vi.fn(),
          onSelectionEnd: vi.fn(),
        }
      )

      // Start selection to initialize metrics
      startSelection(new MouseEvent('mousedown', { clientX: 10, clientY: 20 }))

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 410, // rect.left + rect.width
        clientY: 320, // rect.top + rect.height
      })

      updateSelection(mouseEvent)

      // This is a workaround to wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(selection.value.endX).toBe(800)
      expect(selection.value.endY).toBe(600)
    })
  })

  describe('hasSelection computed property', () => {
    it('should be true for a valid selection', () => {
      const { selection, hasSelection, isSelecting } = useSelection(
        mockCanvas,
        {
          onSelectionUpdate: vi.fn(),
          onSelectionEnd: vi.fn(),
        }
      )
      isSelecting.value = true // Prerequisite for ending selection
      selection.value = {
        startX: 10,
        startY: 10,
        endX: 20,
        endY: 20,
        active: true,
      }
      expect(hasSelection.value).toBe(true)
    })

    it('should be false if width is too small', () => {
      const { selection, hasSelection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })
      selection.value = {
        startX: 10,
        startY: 10,
        endX: 14,
        endY: 20,
        active: true,
      }
      expect(hasSelection.value).toBe(false)
    })

    it('should be false if height is too small', () => {
      const { selection, hasSelection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })
      selection.value = {
        startX: 10,
        startY: 10,
        endX: 20,
        endY: 14,
        active: true,
      }
      expect(hasSelection.value).toBe(false)
    })

    it('should be false if selection is not active', () => {
      const { selection, hasSelection } = useSelection(mockCanvas, {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      })
      selection.value = {
        startX: 10,
        startY: 10,
        endX: 20,
        endY: 20,
        active: false,
      }
      expect(hasSelection.value).toBe(false)
    })
  })
})
