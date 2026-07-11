import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useUndoHistory,
  MAX_UNDO_LEVELS,
  type UndoHistoryDeps,
  type UndoEntry,
} from '../composables/useUndoHistory'
import {
  useImageProcessing,
  applyMosaicEffect,
} from '../composables/useImageProcessing'

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
  ({
    data: new Uint8ClampedArray([tag, tag, tag, 255]),
  }) as unknown as ImageData

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

  describe('applyMosaicEffect (reads pixels from regionData, not ctx.getImageData)', () => {
    // Builds a synthetic region ImageData whose red channel equals each
    // pixel's flat index (localY * width + localX), so sampled colors can
    // be checked against a hand-computed expectation.
    const makeRegionData = (width: number, height: number): ImageData => {
      const data = new Uint8ClampedArray(width * height * 4)
      for (let p = 0; p < width * height; p++) {
        data[p * 4] = p
        data[p * 4 + 1] = 0
        data[p * 4 + 2] = 0
        data[p * 4 + 3] = 255
      }
      return { data, width, height } as unknown as ImageData
    }

    const makeTrackingCtx = () => {
      const fillStyles: string[] = []
      const rects: number[][] = []
      const ctx: {
        fillStyle: string
        fillRect: ReturnType<typeof vi.fn>
        getImageData: ReturnType<typeof vi.fn>
      } = {
        fillStyle: '',
        fillRect: vi.fn(),
        getImageData: vi.fn(),
      }
      ctx.fillRect.mockImplementation(
        (x: number, y: number, w: number, h: number) => {
          fillStyles.push(ctx.fillStyle)
          rects.push([x, y, w, h])
        }
      )
      return {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        fillStyles,
        rects,
      }
    }

    it('samples the center pixel of each block directly from regionData with zero getImageData readbacks', () => {
      const { ctx, fillStyles, rects } = makeTrackingCtx()
      const width = 4
      const height = 4
      const regionData = makeRegionData(width, height)

      // startX/startY are non-zero to prove the local-coordinate conversion
      // (sample - start) is applied correctly, not just at the origin.
      applyMosaicEffect(ctx, regionData, 10, 20, width, height, 2)

      expect(ctx.getImageData).not.toHaveBeenCalled()
      expect(rects).toEqual([
        [10, 20, 2, 2],
        [12, 20, 2, 2],
        [10, 22, 2, 2],
        [12, 22, 2, 2],
      ])
      // Center-of-block sample points -> local pixel indices (localY*4+localX):
      // (1,1)=5, (1,3)=7, (3,1)=13, (3,3)=15
      expect(fillStyles).toEqual([
        'rgb(5, 0, 0)',
        'rgb(7, 0, 0)',
        'rgb(13, 0, 0)',
        'rgb(15, 0, 0)',
      ])
    })

    it('clamps the sample position to the region bounds for a trailing partial block', () => {
      const { ctx, fillStyles, rects } = makeTrackingCtx()
      const width = 4
      const height = 1
      const regionData = makeRegionData(width, height)

      // mosaicSize=3 over a width of 4: the second block only has 1 column
      // left, so its natural sample (x=3 + floor(3/2)=1 -> 4) must clamp
      // down to the last valid column (width-1=3) instead of reading out
      // of range.
      applyMosaicEffect(ctx, regionData, 0, 0, width, height, 3)

      expect(ctx.getImageData).not.toHaveBeenCalled()
      expect(rects).toEqual([
        [0, 0, 3, 1],
        [3, 0, 1, 1],
      ])
      // First block samples local x=1 (p=1); second clamps to local x=3 (p=3).
      expect(fillStyles).toEqual(['rgb(1, 0, 0)', 'rgb(3, 0, 0)'])
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
