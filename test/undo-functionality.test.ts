import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useUndoHistory,
  MAX_UNDO_LEVELS,
  type UndoHistoryDeps,
  type UndoEntry,
} from '../composables/useUndoHistory'
import { useImageProcessing } from '../composables/useImageProcessing'

// Minimal mock shape for CanvasRenderingContext2D. Using vi.fn()'s own
// return type (rather than a cast to the real DOM type) keeps mock helpers
// like `mockReturnValue` available on these properties.
type MockCtx = {
  putImageData: ReturnType<typeof vi.fn>
  getImageData: ReturnType<typeof vi.fn>
  fillStyle: string
  fillRect: ReturnType<typeof vi.fn>
}

const makeImageData = (tag: number): ImageData =>
  ({ data: new Uint8ClampedArray([tag, tag, tag, 255]) }) as unknown as ImageData

describe('Undo Functionality', () => {
  let mockCtx: MockCtx
  let mockCanvas: { width: number; height: number }
  let deps: UndoHistoryDeps

  beforeEach(() => {
    mockCtx = {
      putImageData: vi.fn(),
      getImageData: vi.fn(() => makeImageData(0)),
      fillStyle: '',
      fillRect: vi.fn(),
    }
    mockCanvas = { width: 800, height: 600 }
    deps = {
      getCtx: () => mockCtx as unknown as CanvasRenderingContext2D,
      getCanvas: () => mockCanvas as unknown as HTMLCanvasElement,
      setOriginalImageData: vi.fn(),
    }
  })

  describe('Undo Stack Management (immutable region-diff entries)', () => {
    it('should initialize with empty undo stack', () => {
      const { undoStack, canUndo } = useUndoHistory(deps)
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should push a region-diff entry ({ imageData, x, y }) and enable undo', () => {
      const { undoStack, canUndo, pushUndoEntry } = useUndoHistory(deps)
      const entry: UndoEntry = { imageData: makeImageData(1), x: 10, y: 20 }

      pushUndoEntry(entry)

      expect(undoStack.value.length).toBe(1)
      expect(undoStack.value[0]).toEqual(entry)
      expect(canUndo.value).toBe(true)
    })

    it('should maintain the undo stack size limit', () => {
      const { undoStack, canUndo, pushUndoEntry } = useUndoHistory(deps)
      for (let i = 0; i < MAX_UNDO_LEVELS + 5; i++) {
        pushUndoEntry({ imageData: makeImageData(i), x: i, y: i })
      }

      expect(undoStack.value.length).toBe(MAX_UNDO_LEVELS)
      expect(canUndo.value).toBe(true)
    })

    it('should drop the oldest entries once the limit is exceeded', () => {
      const { undoStack, pushUndoEntry } = useUndoHistory(deps)
      const first: UndoEntry = { imageData: makeImageData(-1), x: -1, y: -1 }
      pushUndoEntry(first)

      for (let i = 0; i < MAX_UNDO_LEVELS; i++) {
        pushUndoEntry({ imageData: makeImageData(i), x: i, y: i })
      }

      expect(undoStack.value.length).toBe(MAX_UNDO_LEVELS)
      expect(undoStack.value[0]).not.toEqual(first) // first entry evicted
      expect(undoStack.value[undoStack.value.length - 1]!.x).toBe(
        MAX_UNDO_LEVELS - 1
      )
    })

    it('should replace the undoStack array reference on every push/pop (fixes in-place mutation)', () => {
      const { undoStack, pushUndoEntry } = useUndoHistory(deps)
      const ref1 = undoStack.value
      pushUndoEntry({ imageData: makeImageData(1), x: 0, y: 0 })
      const ref2 = undoStack.value
      pushUndoEntry({ imageData: makeImageData(2), x: 0, y: 0 })
      const ref3 = undoStack.value

      expect(ref2).not.toBe(ref1)
      expect(ref3).not.toBe(ref2)
    })
  })

  describe('Undo Operations (restores imageData at its captured x/y position)', () => {
    it('should restore the last entry at its recorded position on undo', () => {
      const { pushUndoEntry, undoLastAction } = useUndoHistory(deps)
      const entry: UndoEntry = { imageData: makeImageData(7), x: 42, y: 84 }
      pushUndoEntry(entry)

      const result = undoLastAction()

      expect(result).toBe(true)
      expect(mockCtx.putImageData).toHaveBeenCalledWith(
        entry.imageData,
        entry.x,
        entry.y
      )
    })

    it('should refresh the cached original image data using the full canvas size after undo', () => {
      const { pushUndoEntry, undoLastAction } = useUndoHistory(deps)
      pushUndoEntry({ imageData: makeImageData(1), x: 0, y: 0 })

      undoLastAction()

      expect(mockCtx.getImageData).toHaveBeenCalledWith(
        0,
        0,
        mockCanvas.width,
        mockCanvas.height
      )
      expect(deps.setOriginalImageData).toHaveBeenCalled()
    })

    it('should not undo when the stack is empty', () => {
      const { undoLastAction, canUndo } = useUndoHistory(deps)
      const result = undoLastAction()

      expect(result).toBe(false)
      expect(mockCtx.putImageData).not.toHaveBeenCalled()
      expect(canUndo.value).toBe(false)
    })

    it('should not undo without a canvas context', () => {
      deps.getCtx = () => null
      const { undoLastAction } = useUndoHistory(deps)

      expect(undoLastAction()).toBe(false)
    })

    it('should restore entries in LIFO order across multiple undos', () => {
      const { undoStack, canUndo, pushUndoEntry, undoLastAction } =
        useUndoHistory(deps)
      const e1: UndoEntry = { imageData: makeImageData(1), x: 1, y: 1 }
      const e2: UndoEntry = { imageData: makeImageData(2), x: 2, y: 2 }
      const e3: UndoEntry = { imageData: makeImageData(3), x: 3, y: 3 }
      pushUndoEntry(e1)
      pushUndoEntry(e2)
      pushUndoEntry(e3)

      expect(undoStack.value.length).toBe(3)
      expect(canUndo.value).toBe(true)

      undoLastAction()
      expect(mockCtx.putImageData).toHaveBeenLastCalledWith(
        e3.imageData,
        e3.x,
        e3.y
      )
      expect(undoStack.value.length).toBe(2)

      undoLastAction()
      expect(mockCtx.putImageData).toHaveBeenLastCalledWith(
        e2.imageData,
        e2.x,
        e2.y
      )
      expect(undoStack.value.length).toBe(1)

      undoLastAction()
      expect(mockCtx.putImageData).toHaveBeenLastCalledWith(
        e1.imageData,
        e1.x,
        e1.y
      )
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })
  })

  describe('clearUndoHistory', () => {
    it('should empty the stack and disable undo', () => {
      const { undoStack, canUndo, pushUndoEntry, clearUndoHistory } =
        useUndoHistory(deps)
      pushUndoEntry({ imageData: makeImageData(1), x: 0, y: 0 })
      pushUndoEntry({ imageData: makeImageData(2), x: 0, y: 0 })

      clearUndoHistory()

      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })
  })

  describe('Integration with useImageProcessing.applyMosaic', () => {
    // Verifies that applying an edit saves only the affected region (not a
    // full-canvas snapshot) together with the top-left position it came
    // from, which is what undoLastAction() later needs to restore it.
    it('should push a region-sized entry (not a full canvas snapshot) before editing', () => {
      const pushUndoEntry = vi.fn()
      const regionData = makeImageData(9)
      mockCtx.getImageData = vi
        .fn()
        .mockReturnValueOnce(regionData) // the pre-edit region snapshot
        .mockReturnValue(makeImageData(0)) // subsequent calls (mosaic sampling, final snapshot)

      const { applyMosaic } = useImageProcessing({
        getCtx: () => mockCtx as unknown as CanvasRenderingContext2D,
        getOriginalImageData: () => makeImageData(0),
        setOriginalImageData: vi.fn(),
        getCanvas: () => mockCanvas as unknown as HTMLCanvasElement,
        getProcessingSettings: () => null,
        pushUndoEntry,
      })

      const applied = applyMosaic({
        startX: 10,
        startY: 20,
        endX: 30,
        endY: 50,
        active: true,
      })

      expect(applied).toBe(true)
      expect(mockCtx.getImageData).toHaveBeenCalledWith(10, 20, 20, 30)
      expect(pushUndoEntry).toHaveBeenCalledWith({
        imageData: regionData,
        x: 10,
        y: 20,
      })
    })

    it('should do nothing and return false without a canvas context or original image data', () => {
      const pushUndoEntry = vi.fn()
      const { applyMosaic } = useImageProcessing({
        getCtx: () => null,
        getOriginalImageData: () => null,
        setOriginalImageData: vi.fn(),
        getCanvas: () => mockCanvas as unknown as HTMLCanvasElement,
        getProcessingSettings: () => null,
        pushUndoEntry,
      })

      const applied = applyMosaic({
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 10,
        active: true,
      })

      expect(applied).toBe(false)
      expect(pushUndoEntry).not.toHaveBeenCalled()
    })
  })
})
