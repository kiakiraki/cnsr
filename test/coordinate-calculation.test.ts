import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Coordinate Calculation', () => {
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

    mockCanvas = {
      value: {
        width: 800,
        height: 600,
        getBoundingClientRect: vi.fn(() => mockRect),
      },
    }
  })

  // getEventPosition function extracted from ImageMosaic.vue
  const getEventPosition = (
    event: MouseEvent | TouchEvent,
    canvas: {
      value: {
        width: number
        height: number
        getBoundingClientRect: () => DOMRect
      }
    }
  ) => {
    const rect = canvas.value.getBoundingClientRect()
    const scaleX = canvas.value.width / rect.width
    const scaleY = canvas.value.height / rect.height

    let clientX: number, clientY: number

    if (event instanceof MouseEvent) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  describe('getEventPosition', () => {
    it('should calculate correct canvas coordinates for mouse events', () => {
      const mouseEvent = new MouseEvent('click', {
        clientX: 210, // 10 (rect.left) + 200 (offset)
        clientY: 170, // 20 (rect.top) + 150 (offset)
      })

      const result = getEventPosition(mouseEvent, mockCanvas)

      // Expected: (200 / 400) * 800 = 400, (150 / 300) * 600 = 300
      expect(result.x).toBe(400)
      expect(result.y).toBe(300)
    })

    it('should calculate correct canvas coordinates for touch events', () => {
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

      const result = getEventPosition(touchEvent, mockCanvas)

      // Expected: (100 / 400) * 800 = 200, (100 / 300) * 600 = 200
      expect(result.x).toBe(200)
      expect(result.y).toBe(200)
    })

    it('should handle edge cases - top-left corner', () => {
      const mouseEvent = new MouseEvent('click', {
        clientX: 10, // rect.left
        clientY: 20, // rect.top
      })

      const result = getEventPosition(mouseEvent, mockCanvas)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })

    it('should handle edge cases - bottom-right corner', () => {
      const mouseEvent = new MouseEvent('click', {
        clientX: 410, // rect.left + rect.width
        clientY: 320, // rect.top + rect.height
      })

      const result = getEventPosition(mouseEvent, mockCanvas)

      expect(result.x).toBe(800)
      expect(result.y).toBe(600)
    })

    it('should handle different scaling ratios', () => {
      // Different canvas size
      mockCanvas.value.width = 1600
      mockCanvas.value.height = 1200

      const mouseEvent = new MouseEvent('click', {
        clientX: 210, // 10 (rect.left) + 200 (offset)
        clientY: 170, // 20 (rect.top) + 150 (offset)
      })

      const result = getEventPosition(mouseEvent, mockCanvas)

      // Expected: (200 / 400) * 1600 = 800, (150 / 300) * 1200 = 600
      expect(result.x).toBe(800)
      expect(result.y).toBe(600)
    })
  })

  describe('Selection Area Normalization', () => {
    const normalizeSelection = (selection: {
      startX: number
      startY: number
      endX: number
      endY: number
    }) => {
      const startX = Math.min(selection.startX, selection.endX)
      const startY = Math.min(selection.startY, selection.endY)
      const width = Math.abs(selection.endX - selection.startX)
      const height = Math.abs(selection.endY - selection.startY)

      return { startX, startY, width, height }
    }

    it('should normalize selection when dragging right-down', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 200,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should normalize selection when dragging left-up', () => {
      const selection = {
        startX: 200,
        startY: 200,
        endX: 100,
        endY: 100,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should normalize selection when dragging right-up', () => {
      const selection = {
        startX: 100,
        startY: 200,
        endX: 200,
        endY: 100,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should normalize selection when dragging left-down', () => {
      const selection = {
        startX: 200,
        startY: 100,
        endX: 100,
        endY: 200,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should handle zero-width selection', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 100,
        endY: 200,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(0)
      expect(result.height).toBe(100)
    })

    it('should handle zero-height selection', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 100,
      }

      const result = normalizeSelection(selection)

      expect(result.startX).toBe(100)
      expect(result.startY).toBe(100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(0)
    })
  })

  describe('Selection Validation', () => {
    const isValidSelection = (selection: {
      startX: number
      startY: number
      endX: number
      endY: number
    }) => {
      const width = Math.abs(selection.endX - selection.startX)
      const height = Math.abs(selection.endY - selection.startY)
      return width > 5 && height > 5
    }

    it('should validate selection with sufficient size', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 110,
        endY: 110,
      }

      expect(isValidSelection(selection)).toBe(true)
    })

    it('should invalidate selection with insufficient width', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 104,
        endY: 110,
      }

      expect(isValidSelection(selection)).toBe(false)
    })

    it('should invalidate selection with insufficient height', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 110,
        endY: 104,
      }

      expect(isValidSelection(selection)).toBe(false)
    })

    it('should invalidate selection with both dimensions too small', () => {
      const selection = {
        startX: 100,
        startY: 100,
        endX: 103,
        endY: 104,
      }

      expect(isValidSelection(selection)).toBe(false)
    })

    it('should validate selection regardless of drag direction', () => {
      const selection = {
        startX: 110,
        startY: 110,
        endX: 100,
        endY: 100,
      }

      expect(isValidSelection(selection)).toBe(true)
    })
  })
})
