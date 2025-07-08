import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

describe('Undo Functionality', () => {
  let undoStack: { value: ImageData[] }
  let canUndo: { value: boolean }
  let mockCanvas: {
    value: {
      width: number
      height: number
      getContext: () => CanvasRenderingContext2D
    }
  }
  let mockCtx: CanvasRenderingContext2D | null
  let originalImageData: ImageData | null
  const MAX_UNDO_LEVELS = 64

  beforeEach(() => {
    undoStack = ref<ImageData[]>([])
    canUndo = ref(false)
    originalImageData = {
      data: new Uint8ClampedArray([255, 255, 255, 255]), // White pixel
      width: 1,
      height: 1,
    }

    mockCtx = {
      putImageData: vi.fn(),
      getImageData: vi.fn(() => originalImageData),
      fillStyle: '',
      fillRect: vi.fn(),
    }

    mockCanvas = {
      value: {
        width: 800,
        height: 600,
        getContext: vi.fn(() => mockCtx),
      },
    }
  })

  const addToUndoStack = (imageData: ImageData | null) => {
    undoStack.value.push(imageData)
    if (undoStack.value.length > MAX_UNDO_LEVELS) {
      undoStack.value.shift()
    }
    canUndo.value = undoStack.value.length > 0
  }

  const applyProcessing = (processType: 'blackfill' | 'mosaic') => {
    // Save current state to undo stack before making changes
    const currentState = mockCtx.getImageData(
      0,
      0,
      mockCanvas.value.width,
      mockCanvas.value.height
    )
    addToUndoStack(currentState)

    // Apply processing (mocked)
    if (processType === 'blackfill') {
      mockCtx.fillStyle = '#000000'
      mockCtx.fillRect(0, 0, 100, 100)
    } else if (processType === 'mosaic') {
      // Mock mosaic processing
      mockCtx.fillStyle = '#888888'
      mockCtx.fillRect(0, 0, 100, 100)
    }

    // Update original image data
    originalImageData = mockCtx.getImageData(
      0,
      0,
      mockCanvas.value.width,
      mockCanvas.value.height
    )
  }

  const undoLastAction = () => {
    if (!mockCtx || undoStack.value.length <= 0) return false

    const previousState = undoStack.value.pop()
    mockCtx.putImageData(previousState, 0, 0)

    originalImageData = mockCtx.getImageData(
      0,
      0,
      mockCanvas.value.width,
      mockCanvas.value.height
    )

    canUndo.value = undoStack.value.length > 0
    return true
  }

  const resetToOriginal = () => {
    if (!mockCtx) return

    // Clear canvas and redraw original image
    mockCtx.putImageData(originalImageData, 0, 0)

    // Reset undo stack
    undoStack.value = []
    canUndo.value = false
  }

  describe('Undo Stack Management', () => {
    it('should initialize with empty undo stack', () => {
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should add state to undo stack when processing is applied', () => {
      applyProcessing('blackfill')

      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)
      expect(mockCtx.getImageData).toHaveBeenCalled()
    })

    it('should maintain undo stack size limit', () => {
      // Apply processing more than MAX_UNDO_LEVELS times
      for (let i = 0; i < MAX_UNDO_LEVELS + 5; i++) {
        applyProcessing('blackfill')
      }

      expect(undoStack.value.length).toBe(MAX_UNDO_LEVELS)
      expect(canUndo.value).toBe(true)
    })

    it('should remove oldest entries when exceeding limit', () => {
      const firstState = { data: 'first-state' }
      // Remove unused variable

      // Manually add to test limit behavior
      undoStack.value.push(firstState)

      // Fill stack to maximum
      for (let i = 0; i < MAX_UNDO_LEVELS; i++) {
        addToUndoStack({
          data: new Uint8ClampedArray([i, i, i, 255]),
          width: 1,
          height: 1,
        } as ImageData)
      }

      expect(undoStack.value.length).toBe(MAX_UNDO_LEVELS)
      expect(undoStack.value[0]).not.toEqual(firstState) // First entry should be removed
    })
  })

  describe('Undo Operations', () => {
    it('should undo last action successfully', () => {
      applyProcessing('blackfill')
      const result = undoLastAction()

      expect(result).toBe(true)
      expect(mockCtx.putImageData).toHaveBeenCalled()
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should not undo when stack is empty', () => {
      const result = undoLastAction()

      expect(result).toBe(false)
      expect(mockCtx.putImageData).not.toHaveBeenCalled()
      expect(canUndo.value).toBe(false)
    })

    it('should handle multiple undo operations', () => {
      applyProcessing('blackfill')
      applyProcessing('mosaic')
      applyProcessing('blackfill')

      expect(undoStack.value.length).toBe(3)
      expect(canUndo.value).toBe(true)

      // First undo
      undoLastAction()
      expect(undoStack.value.length).toBe(2)
      expect(canUndo.value).toBe(true)

      // Second undo
      undoLastAction()
      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)

      // Third undo
      undoLastAction()
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should restore correct image data on undo', () => {
      const mockImageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255]), // Red pixel
        width: 1,
        height: 1,
      }

      // Mock getImageData to return specific data
      mockCtx.getImageData.mockReturnValue(mockImageData)

      applyProcessing('blackfill')
      undoLastAction()

      expect(mockCtx.putImageData).toHaveBeenCalledWith(mockImageData, 0, 0)
    })
  })

  describe('Reset to Original', () => {
    it('should reset to original state', () => {
      applyProcessing('blackfill')
      applyProcessing('mosaic')

      expect(undoStack.value.length).toBe(2)
      expect(canUndo.value).toBe(true)

      resetToOriginal()

      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
      expect(mockCtx.putImageData).toHaveBeenCalled()
    })

    it('should clear undo stack on reset', () => {
      applyProcessing('blackfill')
      applyProcessing('mosaic')
      applyProcessing('blackfill')

      resetToOriginal()

      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })
  })

  describe('Processing Integration', () => {
    it('should save state before blackfill processing', () => {
      applyProcessing('blackfill')

      expect(mockCtx.getImageData).toHaveBeenCalledWith(
        0,
        0,
        mockCanvas.value.width,
        mockCanvas.value.height
      )
      expect(mockCtx.fillStyle).toBe('#000000')
      expect(mockCtx.fillRect).toHaveBeenCalled()
      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)
    })

    it('should save state before mosaic processing', () => {
      applyProcessing('mosaic')

      expect(mockCtx.getImageData).toHaveBeenCalledWith(
        0,
        0,
        mockCanvas.value.width,
        mockCanvas.value.height
      )
      expect(mockCtx.fillStyle).toBe('#888888')
      expect(mockCtx.fillRect).toHaveBeenCalled()
      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)
    })

    it('should handle alternating processing types', () => {
      applyProcessing('blackfill')
      applyProcessing('mosaic')
      applyProcessing('blackfill')

      expect(undoStack.value.length).toBe(3)
      expect(canUndo.value).toBe(true)

      // Undo mosaic (last action)
      undoLastAction()
      expect(undoStack.value.length).toBe(2)

      // Undo blackfill
      undoLastAction()
      expect(undoStack.value.length).toBe(1)

      // Undo first blackfill
      undoLastAction()
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undo without canvas context', () => {
      mockCtx = null
      const result = undoLastAction()

      expect(result).toBe(false)
      expect(canUndo.value).toBe(false)
    })

    it('should handle reset without canvas context', () => {
      mockCtx = null

      // Should not throw error
      expect(() => resetToOriginal()).not.toThrow()
    })

    it('should handle processing with empty original image data', () => {
      originalImageData = null
      mockCtx.getImageData.mockReturnValue(null)

      applyProcessing('blackfill')

      // Should still add to stack even with null data
      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)
    })

    it('should handle rapid processing applications', () => {
      // Simulate rapid user actions
      for (let i = 0; i < 10; i++) {
        applyProcessing(i % 2 === 0 ? 'blackfill' : 'mosaic')
      }

      expect(undoStack.value.length).toBe(10)
      expect(canUndo.value).toBe(true)

      // Undo all actions
      for (let i = 0; i < 10; i++) {
        undoLastAction()
      }

      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })
  })
})
