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

const applyMosaicEffect = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  width: number,
  height: number,
  mosaicSize: number
) => {
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

      // Get the color data of the sample pixel
      const imageData = ctx.getImageData(sampleX, sampleY, 1, 1)
      const pixelData = imageData.data
      const r = pixelData[0]
      const g = pixelData[1]
      const b = pixelData[2]

      // Fill the block with the sampled color
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      const blockWidth = Math.min(mosaicSize, width - x)
      const blockHeight = Math.min(mosaicSize, height - y)
      ctx.fillRect(startX + x, startY + y, blockWidth, blockHeight)
    }
  }
}

const applyBlur = (
  ctx: CanvasRenderingContext2D,
  canvasEl: HTMLCanvasElement,
  startX: number,
  startY: number,
  width: number,
  height: number,
  blurRadius: number
) => {
  // Save current context state
  ctx.save()

  // Create clipping path for selected region only
  ctx.beginPath()
  ctx.rect(startX, startY, width, height)
  ctx.clip()

  // Apply blur filter and redraw the entire canvas within clipped region
  ctx.filter = `blur(${blurRadius}px)`
  ctx.drawImage(canvasEl, 0, 0)

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
