import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, shallowRef, type Ref } from 'vue'
import type { Mock } from 'vitest'
import { useUndo } from '~/composables/useUndo'
import {
  useImageProcessor,
  type ProcessingMode,
} from '~/composables/useImageProcessor'
import type { SelectionArea } from '~/composables/useSelection'

// Mock ImageData
const createMockImageData = (): ImageData => ({
  data: new Uint8ClampedArray([255, 0, 0, 255]),
  width: 10,
  height: 10,
  colorSpace: 'srgb',
})

type MockContext = {
  putImageData: Mock<unknown[], unknown>
  getImageData: Mock<unknown[], ImageData>
  drawImage: Mock<unknown[], unknown>
  clearRect: Mock<unknown[], unknown>
  save: Mock<unknown[], unknown>
  restore: Mock<unknown[], unknown>
  beginPath: Mock<unknown[], unknown>
  rect: Mock<unknown[], unknown>
  clip: Mock<unknown[], unknown>
  fillRect: Mock<unknown[], unknown>
  filter: string
}

describe('Undo and Image Processor Integration', () => {
  let mockCanvas: Ref<{
    width: number
    height: number
    getContext: () => MockContext
    toDataURL: () => string
    getBoundingClientRect: () => DOMRect
  }>
  let mockContext: MockContext
  let mockSelection: Ref<SelectionArea>
  let mockProcessingMode: Ref<ProcessingMode>

  beforeEach(() => {
    mockContext = {
      putImageData: vi.fn(),
      getImageData: vi.fn(() => createMockImageData()),
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
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        x: 0,
        y: 0,
        bottom: 10,
        right: 10,
        toJSON: () => ({}),
      }),
    })
    mockSelection = shallowRef<SelectionArea>({
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 10,
      active: true,
    })
    mockProcessingMode = ref<ProcessingMode>('blackfill')
  })

  it('should push state to undo stack when processing is applied', async () => {
    const { canUndo, pushStateToUndoStack } = useUndo()
    const onProcessingComplete = vi.fn()
    const { applyProcessing, loadImageToCanvas } = useImageProcessor(
      mockCanvas,
      mockProcessingMode,
      mockSelection,
      { onProcessingComplete, pushStateToUndoStack }
    )

    expect(canUndo.value).toBe(false)
    // Processor needs to be initialized by loading an image first
    await loadImageToCanvas('fake-src')
    applyProcessing()
    expect(canUndo.value).toBe(true)
    expect(onProcessingComplete).toHaveBeenCalled()
  })

  it('should restore previous state on undo', async () => {
    const { canUndo, pushStateToUndoStack, popStateFromUndoStack } = useUndo()
    const { applyProcessing, restoreState, loadImageToCanvas } =
      useImageProcessor(mockCanvas, mockProcessingMode, mockSelection, {
        onProcessingComplete: vi.fn(),
        pushStateToUndoStack,
      })

    await loadImageToCanvas('fake-src')
    applyProcessing()
    applyProcessing()

    const lastState = popStateFromUndoStack()
    expect(lastState).toBeDefined()

    if (lastState) {
      restoreState(lastState)
    }

    expect(mockContext.putImageData).toHaveBeenCalledWith(lastState, 0, 0)
    expect(canUndo.value).toBe(true) // one state left
  })
})
