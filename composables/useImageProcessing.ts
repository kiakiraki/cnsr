import { ref } from 'vue'
import type { UndoEntry } from './useUndoHistory'
import type { SelectionArea } from './useAreaSelection'

export type ProcessingMode = 'blackfill' | 'whitefill' | 'mosaic' | 'blur'

export interface ProcessingSettings {
  mosaicSize: number
  blurRadius: number
  lineWidth: number
}

export interface UseImageProcessingDeps {
  getCtx: () => CanvasRenderingContext2D | null
  getOriginalImageData: () => ImageData | null
  setOriginalImageData: (data: ImageData | null) => void
  getCanvas: () => HTMLCanvasElement | undefined
  getProcessingSettings: () => ProcessingSettings | null
  pushUndoEntry: (entry: UndoEntry) => void
}

const applyBlackfill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  width: number,
  height: number
) => {
  ctx.fillStyle = '#000000'
  ctx.fillRect(startX, startY, width, height)
}

const applyWhitefill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  width: number,
  height: number
) => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(startX, startY, width, height)
}

/**
 * Paints the mosaic effect onto `ctx` by sampling each block's color from
 * `regionData` - the ImageData for exactly [startX, startY, width, height]
 * that the caller already captured for the undo stack - instead of issuing
 * a `ctx.getImageData(sampleX, sampleY, 1, 1)` readback per block. A 500px
 * selection at typical mosaicSize used to trigger ~440 synchronous
 * GPU->CPU readbacks; this reduces that to zero (one readback total,
 * shared with the undo snapshot). Sampling position and clamping are
 * unchanged from the original per-pixel implementation.
 */
export const applyMosaicEffect = (
  ctx: CanvasRenderingContext2D,
  regionData: ImageData,
  startX: number,
  startY: number,
  width: number,
  height: number,
  mosaicSize: number
) => {
  const { data } = regionData

  for (let y = 0; y < height; y += mosaicSize) {
    for (let x = 0; x < width; x += mosaicSize) {
      // Get a sample pixel from the center of each block
      const sampleX = Math.min(
        startX + x + Math.floor(mosaicSize / 2),
        startX + width - 1
      )
      const sampleY = Math.min(
        startY + y + Math.floor(mosaicSize / 2),
        startY + height - 1
      )

      // Read the sample pixel directly out of the already-captured region
      // data (local coordinates relative to the region's top-left corner).
      const localX = sampleX - startX
      const localY = sampleY - startY
      const pixelIndex = (localY * width + localX) * 4
      const r = data[pixelIndex]
      const g = data[pixelIndex + 1]
      const b = data[pixelIndex + 2]

      // Fill the block with the sampled color
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      const blockWidth = Math.min(mosaicSize, width - x)
      const blockHeight = Math.min(mosaicSize, height - y)
      ctx.fillRect(startX + x, startY + y, blockWidth, blockHeight)
    }
  }
}

/**
 * Applies a blur to the selected region only. Rather than re-drawing the
 * *entire* canvas through a blur filter (the previous implementation),
 * only a small margin-padded crop around the selection is copied into a
 * scratch canvas and blurred - the amount of work scales with the
 * selection size instead of the whole image. The margin (2x blurRadius)
 * gives the blur kernel enough surrounding pixels to reproduce the same
 * edge softening as the full-canvas version.
 */
const applyBlur = (
  ctx: CanvasRenderingContext2D,
  canvasEl: HTMLCanvasElement,
  startX: number,
  startY: number,
  width: number,
  height: number,
  blurRadius: number
) => {
  const margin = blurRadius * 2
  const srcX = Math.max(0, startX - margin)
  const srcY = Math.max(0, startY - margin)
  const srcRight = Math.min(canvasEl.width, startX + width + margin)
  const srcBottom = Math.min(canvasEl.height, startY + height + margin)
  const srcWidth = srcRight - srcX
  const srcHeight = srcBottom - srcY

  if (srcWidth <= 0 || srcHeight <= 0) return

  // Crop just the margin-padded source region (not the whole canvas) into
  // a scratch canvas that will be drawn back through the blur filter.
  const scratch = document.createElement('canvas')
  scratch.width = srcWidth
  scratch.height = srcHeight
  const scratchCtx = scratch.getContext('2d')
  if (!scratchCtx) return
  scratchCtx.drawImage(
    canvasEl,
    srcX,
    srcY,
    srcWidth,
    srcHeight,
    0,
    0,
    srcWidth,
    srcHeight
  )

  // Save current context state
  ctx.save()

  // Create clipping path for selected region only
  ctx.beginPath()
  ctx.rect(startX, startY, width, height)
  ctx.clip()

  // Apply blur filter and redraw just the cropped scratch region, aligned
  // back to its original position, within the clipped selection.
  ctx.filter = `blur(${blurRadius}px)`
  ctx.drawImage(scratch, srcX, srcY)

  // Restore context state (removes clip and filter)
  ctx.restore()
}

/**
 * Owns the currently-selected processing mode and applies it to a given
 * selection area. Saving the pre-edit region to the undo stack is
 * delegated to useUndoHistory via deps.pushUndoEntry.
 */
export function useImageProcessing(deps: UseImageProcessingDeps) {
  const processingMode = ref<ProcessingMode>('blackfill')

  /**
   * Applies the current processing mode to `selection`. Returns true if the
   * edit was applied (and the caller should refresh the processed image),
   * false if there was nothing to draw onto yet.
   */
  const applyMosaic = (selection: SelectionArea): boolean => {
    const ctx = deps.getCtx()
    const originalImageData = deps.getOriginalImageData()
    if (!ctx || !originalImageData) return false

    const startX = Math.min(selection.startX, selection.endX)
    const startY = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    // Save only the affected region to undo stack before making changes
    ctx.putImageData(originalImageData, 0, 0)
    const regionData = ctx.getImageData(startX, startY, width, height)
    deps.pushUndoEntry({ imageData: regionData, x: startX, y: startY })

    const settings = deps.getProcessingSettings()

    switch (processingMode.value) {
      case 'blackfill':
        applyBlackfill(ctx, startX, startY, width, height)
        break
      case 'whitefill':
        applyWhitefill(ctx, startX, startY, width, height)
        break
      case 'mosaic':
        applyMosaicEffect(
          ctx,
          regionData,
          startX,
          startY,
          width,
          height,
          settings?.mosaicSize || 10
        )
        break
      case 'blur': {
        const canvasEl = deps.getCanvas()
        if (canvasEl) {
          applyBlur(
            ctx,
            canvasEl,
            startX,
            startY,
            width,
            height,
            settings?.blurRadius || 5
          )
        }
        break
      }
    }

    // Update original image data to include the applied edit
    const canvasEl = deps.getCanvas()
    if (canvasEl) {
      deps.setOriginalImageData(
        ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
      )
    }

    return true
  }

  return {
    processingMode,
    applyMosaic,
  }
}
