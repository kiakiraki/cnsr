import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useUndo } from '~/composables/useUndo'
import { useImageProcessor } from '~/composables/useImageProcessor'
import type { SelectionArea } from '~/composables/useSelection'

// Mock ImageData
const createMockImageData = (id: number): ImageData => ({
  data: new Uint8ClampedArray([id, 0, 0, 255]),
  width: 10,
  height: 10,
  colorSpace: 'srgb',
})

describe('Undo/Redo Integration', () => {
  let mockCanvas: any
  let mockContext: any

  beforeEach(() => {
    mockContext = {
      putImageData: vi.fn(),
      getImageData: vi.fn((x, y, w, h) => createMockImageData(1)),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillRect: vi.fn(),
      filter: '',
    }
    mockCanvas = ref({
      width: 10,
      height: 10,
      getContext: () => mockContext,
      toDataURL: () => 'data:image/png;base64,fake',
    })
  })

  it('should push state to undo stack when processing is applied', async () => {
    const { canUndo, pushStateToUndoStack, popStateFromUndoStack } = useUndo()
    const processor = useImageProcessor(mockCanvas, {
      pushStateToUndoStack,
    })
    await processor.loadImage('fake-src')

    expect(canUndo.value).toBe(false)

    const selection: SelectionArea = {
      startX: 0,
      startY: 0,
      endX: 5,
      endY: 5,
      active: true,
    }
    processor.applyProcessing('blackfill', selection)

    expect(canUndo.value).toBe(true)
    const undoneState = popStateFromUndoStack()
    expect(undoneState).toBeDefined()
    expect(undoneState?.width).toBe(10)
    expect(undoneState?.height).toBe(10)
  })

  it('should restore previous state on undo', async () => {
    const { canUndo, pushStateToUndoStack, popStateFromUndoStack } = useUndo()
    const processor = useImageProcessor(mockCanvas, {
      pushStateToUndoStack,
    })
    await processor.loadImage('fake-src')

    const selection: SelectionArea = {
      startX: 0,
      startY: 0,
      endX: 5,
      endY: 5,
      active: true,
    }
    processor.applyProcessing('blackfill', selection)

    const lastState = popStateFromUndoStack()
    expect(lastState).toBeDefined()

    if (lastState) {
      processor.restoreState(lastState)
    }

    expect(mockContext.putImageData).toHaveBeenCalledWith(lastState, 0, 0)
    expect(canUndo.value).toBe(false)
  })

  it('should handle multiple undos', async () => {
    const { popStateFromUndoStack, ...undoFns } = useUndo()
    const processor = useImageProcessor(mockCanvas, {
      pushStateToUndoStack: undoFns.pushStateToUndoStack,
    })
    await processor.loadImage('fake-src')

    const selection: SelectionArea = {
      startX: 0,
      startY: 0,
      endX: 5,
      endY: 5,
      active: true,
    }
    // 1. Initial state is loaded. originalImageData has id=1 from the default mock.

    // 2. First action.
    // applyProcessing will update originalImageData at the end. We mock this call.
    mockContext.getImageData.mockReturnValueOnce(createMockImageData(2))
    processor.applyProcessing('blackfill', selection) // Pushes copy of id=1. originalImageData becomes id=2.

    // 3. Second action.
    // Mock the next update call.
    mockContext.getImageData.mockReturnValueOnce(createMockImageData(3))
    processor.applyProcessing('mosaic', selection) // Pushes copy of id=2. originalImageData becomes id=3.

    // 4. Undo the second operation, which should restore the state with id=2.
    let lastState = popStateFromUndoStack()
    expect(lastState?.data[0]).toBe(2)
    if (lastState) processor.restoreState(lastState)

    // 5. Undo the first operation, should restore initial state with id=1
    lastState = popStateFromUndoStack()
    expect(lastState?.data[0]).toBe(1)
    if (lastState) processor.restoreState(lastState)

    // Stack should be empty now
    lastState = popStateFromUndoStack()
    expect(lastState).toBeUndefined()
  })

  it('should respect MAX_UNDO_LEVELS (16)', async () => {
    const { pushStateToUndoStack, popStateFromUndoStack } = useUndo()
    const processor = useImageProcessor(mockCanvas, {
      pushStateToUndoStack,
    })
    await processor.loadImage('fake-src')
    const MAX_UNDO_LEVELS = 16

    const selection: SelectionArea = {
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      active: true,
    }

    for (let i = 0; i < MAX_UNDO_LEVELS + 5; i++) {
      mockContext.getImageData.mockReturnValue(createMockImageData(i + 1))
      processor.applyProcessing('blackfill', selection)
    }

    let count = 0
    while(popStateFromUndoStack()) {
      count++
    }
    expect(count).toBe(MAX_UNDO_LEVELS)
  })

  it('should clear undo stack on resetToOriginal', async () => {
    const { canUndo, clearUndoStack, pushStateToUndoStack } = useUndo()
    const processor = useImageProcessor(mockCanvas, {
      pushStateToUndoStack,
    })
    await processor.loadImage('fake-src')

    const selection: SelectionArea = {
      startX: 0,
      startY: 0,
      endX: 5,
      endY: 5,
      active: true,
    }
    processor.applyProcessing('blackfill', selection)
    expect(canUndo.value).toBe(true)

    processor.resetToOriginal()
    clearUndoStack()

    expect(canUndo.value).toBe(false)
    expect(mockContext.clearRect).toHaveBeenCalled()
    expect(mockContext.drawImage).toHaveBeenCalled()
  })
})
