import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  useAreaSelection,
  type UseAreaSelectionDeps,
} from '../composables/useAreaSelection'
import { useImageProcessing } from '../composables/useImageProcessing'
import { useImageUpload } from '../composables/useImageUpload'
import { useUndoHistory } from '../composables/useUndoHistory'

describe('State Management', () => {
  describe('Selection State Lifecycle', () => {
    let deps: UseAreaSelectionDeps
    let mockRect: DOMRect

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
      deps = {
        canvas: ref({ width: 400, height: 300 } as HTMLCanvasElement),
        updateCanvasMetrics: vi.fn(),
        getCanvasRect: () => mockRect,
        getScale: () => ({ scaleX: 1, scaleY: 1 }),
        redrawCanvas: vi.fn(),
      }
    })

    const down = (x: number, y: number) =>
      new MouseEvent('mousedown', { clientX: x, clientY: y })
    const move = (x: number, y: number) =>
      new MouseEvent('mousemove', { clientX: x, clientY: y })
    const up = () => new MouseEvent('mouseup')

    it('should start selection correctly', () => {
      const s = useAreaSelection(deps)
      s.startSelection(down(100, 100))

      expect(s.selection.value.startX).toBe(100)
      expect(s.selection.value.startY).toBe(100)
      expect(s.selection.value.endX).toBe(100)
      expect(s.selection.value.endY).toBe(100)
      expect(s.selection.value.active).toBe(true)
      expect(s.isSelecting.value).toBe(true)
      expect(s.hasSelection.value).toBe(false)
    })

    it('should update selection coordinates during drag', async () => {
      const s = useAreaSelection(deps)
      s.startSelection(down(100, 100))
      s.updateSelection(move(150, 150))
      // updateSelection schedules its work via requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(s.selection.value.startX).toBe(100)
      expect(s.selection.value.startY).toBe(100)
      expect(s.selection.value.endX).toBe(150)
      expect(s.selection.value.endY).toBe(150)
      expect(s.isSelecting.value).toBe(true)
      expect(deps.redrawCanvas).toHaveBeenCalled()
    })

    it('should not update selection when not selecting', async () => {
      const s = useAreaSelection(deps)
      s.updateSelection(move(150, 150))
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(s.selection.value.endX).toBe(0)
      expect(s.selection.value.endY).toBe(0)
    })

    it('should end selection with valid size', () => {
      const s = useAreaSelection(deps)
      s.startSelection(down(100, 100))
      s.selection.value.endX = 120
      s.selection.value.endY = 120
      s.endSelection(up())

      expect(s.isSelecting.value).toBe(false)
      expect(s.hasSelection.value).toBe(true)
    })

    it('should end selection with invalid size', () => {
      const s = useAreaSelection(deps)
      s.startSelection(down(100, 100))
      s.selection.value.endX = 103
      s.selection.value.endY = 103
      s.endSelection(up())

      expect(s.isSelecting.value).toBe(false)
      expect(s.hasSelection.value).toBe(false)
    })

    it('should not end selection if not selecting', () => {
      const s = useAreaSelection(deps)
      s.endSelection(up())

      expect(s.isSelecting.value).toBe(false)
      expect(s.hasSelection.value).toBe(false)
    })

    it('should invoke onSelectionEnd only for a valid selection', () => {
      const onSelectionEnd = vi.fn()
      const s = useAreaSelection({ ...deps, onSelectionEnd })

      s.startSelection(down(100, 100))
      s.selection.value.endX = 103
      s.selection.value.endY = 103
      s.endSelection(up())
      expect(onSelectionEnd).not.toHaveBeenCalled()

      s.startSelection(down(100, 100))
      s.selection.value.endX = 150
      s.selection.value.endY = 150
      s.endSelection(up())
      expect(onSelectionEnd).toHaveBeenCalledTimes(1)
      expect(onSelectionEnd).toHaveBeenCalledWith(s.selection.value)
    })

    it('should reset selection state via clearSelectionState', () => {
      const s = useAreaSelection(deps)
      s.startSelection(down(100, 100))
      s.selection.value.endX = 150
      s.selection.value.endY = 150
      s.endSelection(up())
      s.clearSelectionState()

      expect(s.selection.value.active).toBe(false)
      expect(s.hasSelection.value).toBe(false)
      expect(s.isSelecting.value).toBe(false)
    })

    it('should clear the overlay (not the main canvas) when clearing selection state', () => {
      const clearOverlay = vi.fn()
      const s = useAreaSelection({ ...deps, clearOverlay })
      s.startSelection(down(100, 100))

      s.clearSelectionState()

      expect(clearOverlay).toHaveBeenCalledTimes(1)
    })

    it('should tolerate a missing clearOverlay dependency', () => {
      const s = useAreaSelection(deps) // deps has no clearOverlay
      s.startSelection(down(100, 100))

      expect(() => s.clearSelectionState()).not.toThrow()
    })

    it('should handle complete selection lifecycle', () => {
      const s = useAreaSelection(deps)

      s.startSelection(down(100, 100))
      expect(s.isSelecting.value).toBe(true)
      expect(s.hasSelection.value).toBe(false)

      s.selection.value.endX = 150
      s.selection.value.endY = 150
      expect(s.selection.value.endX).toBe(150)
      expect(s.selection.value.endY).toBe(150)

      s.endSelection(up())
      expect(s.isSelecting.value).toBe(false)
      expect(s.hasSelection.value).toBe(true)

      s.clearSelectionState()
      expect(s.selection.value.active).toBe(false)
      expect(s.hasSelection.value).toBe(false)
    })
  })

  describe('Processing Mode State', () => {
    const makeImageProcessing = () =>
      useImageProcessing({
        getCtx: () => null,
        getOriginalImageData: () => null,
        setOriginalImageData: vi.fn(),
        getCanvas: () => undefined,
        getProcessingSettings: () => null,
        pushUndoEntry: vi.fn(),
      })

    it('should initialize with blackfill mode', () => {
      const { processingMode } = makeImageProcessing()
      expect(processingMode.value).toBe('blackfill')
    })

    it('should switch to mosaic mode', () => {
      const { processingMode } = makeImageProcessing()
      processingMode.value = 'mosaic'
      expect(processingMode.value).toBe('mosaic')
    })

    it('should switch back to blackfill mode', () => {
      const { processingMode } = makeImageProcessing()
      processingMode.value = 'mosaic'
      processingMode.value = 'blackfill'
      expect(processingMode.value).toBe('blackfill')
    })
  })

  describe('Image State Management', () => {
    it('should initialize with no images', () => {
      const { uploadedImage, hasProcessedImage } = useImageUpload()
      expect(uploadedImage.value).toBe(false)
      expect(hasProcessedImage.value).toBe(false)
    })

    it('should record the original filename via processImageFile', () => {
      const { originalFileName, processImageFile } = useImageUpload()
      const file = new File(['fake'], 'photo.png', { type: 'image/png' })

      processImageFile(file)

      // originalFileName is set synchronously; uploadedImage itself only
      // flips to true once the image finishes decoding (exercised in
      // download-functionality.test.ts via the mocked FileReader).
      expect(originalFileName.value).toBe('photo.png')
    })

    it('should reset images via resetImage', () => {
      const { uploadedImage, hasProcessedImage, originalFileName, resetImage } =
        useImageUpload()
      uploadedImage.value = true
      hasProcessedImage.value = true
      originalFileName.value = 'photo.png'

      resetImage()

      expect(uploadedImage.value).toBe(false)
      expect(hasProcessedImage.value).toBe(false)
      expect(originalFileName.value).toBe('')
    })
  })

  describe('Undo State Management', () => {
    const makeUndoHistory = (canvasSize = { width: 800, height: 600 }) => {
      const ctx = {
        putImageData: vi.fn(),
        getImageData: vi.fn(
          () => ({ data: new Uint8ClampedArray(4) }) as unknown as ImageData
        ),
      } as unknown as CanvasRenderingContext2D
      const setOriginalImageData = vi.fn()
      const undoHistory = useUndoHistory({
        getCtx: () => ctx,
        getCanvas: () => canvasSize as unknown as HTMLCanvasElement,
        setOriginalImageData,
      })
      return { ctx, setOriginalImageData, ...undoHistory }
    }

    const fakeEntry = (n: number) => ({
      imageData: { data: new Uint8ClampedArray([n]) } as unknown as ImageData,
      x: n,
      y: n,
    })

    it('should initialize with no undo available', () => {
      const { canUndo, undoStack } = makeUndoHistory()
      expect(canUndo.value).toBe(false)
      expect(undoStack.value.length).toBe(0)
    })

    it('should add to undo stack and enable undo', () => {
      const { canUndo, undoStack, pushUndoEntry } = makeUndoHistory()
      pushUndoEntry(fakeEntry(1))

      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)
    })

    it('should maintain undo stack size limit', () => {
      const { canUndo, undoStack, pushUndoEntry } = makeUndoHistory()
      for (let i = 0; i < 64 + 10; i++) {
        pushUndoEntry(fakeEntry(i))
      }

      expect(undoStack.value.length).toBe(64)
      expect(canUndo.value).toBe(true)
      // Oldest entries should have been dropped, newest retained
      expect(undoStack.value[undoStack.value.length - 1]!.x).toBe(73)
    })

    it('should undo and disable undo once the stack is empty', () => {
      const { canUndo, undoStack, pushUndoEntry, undoLastAction } =
        makeUndoHistory()
      pushUndoEntry(fakeEntry(1))
      pushUndoEntry(fakeEntry(2))

      expect(undoLastAction()).toBe(true)
      expect(undoStack.value.length).toBe(1)
      expect(canUndo.value).toBe(true)

      expect(undoLastAction()).toBe(true)
      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should return false when trying to undo an empty stack', () => {
      const { undoLastAction, canUndo } = makeUndoHistory()
      expect(undoLastAction()).toBe(false)
      expect(canUndo.value).toBe(false)
    })

    it('should reset undo stack via clearUndoHistory', () => {
      const { canUndo, undoStack, pushUndoEntry, clearUndoHistory } =
        makeUndoHistory()
      pushUndoEntry(fakeEntry(1))
      pushUndoEntry(fakeEntry(2))

      clearUndoHistory()

      expect(undoStack.value.length).toBe(0)
      expect(canUndo.value).toBe(false)
    })

    it('should replace the undoStack array reference on every mutation (immutable updates)', () => {
      const { undoStack, pushUndoEntry } = makeUndoHistory()
      const before = undoStack.value
      pushUndoEntry(fakeEntry(1))
      expect(undoStack.value).not.toBe(before)
    })
  })
})
