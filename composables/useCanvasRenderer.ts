import { ref, computed, onMounted, onUnmounted } from 'vue'
import { resizeImageIfNeeded } from './useImageUpload'
import type { SelectionArea } from './useAreaSelection'

export interface LoadImageCallbacks {
  /** The <img> element itself failed to decode/load. */
  onLoadError?: () => void
  /** Resizing/drawing the successfully-loaded image failed. */
  onProcessError?: () => void
  /** The image was successfully drawn to the canvas. */
  onSuccess?: () => void
}

/**
 * Owns the canvas element, its 2D rendering context, and the cached
 * "original" image data used to restore/re-draw the canvas. `ctx`,
 * `originalImageData`, and `currentImage` intentionally stay as plain
 * closure variables (not refs) - the template never reads them directly,
 * and Vue's reactivity would only add proxy overhead for large ImageData
 * buffers.
 */
export function useCanvasRenderer() {
  const canvas = ref<HTMLCanvasElement>()
  const canvasContainer = ref<HTMLDivElement>()

  let ctx: CanvasRenderingContext2D | null = null
  let originalImageData: ImageData | null = null
  let currentImage: HTMLImageElement | null = null

  // Reactive mirrors of canvas.width/canvas.height. canvas.width/height are
  // plain DOM properties, not reactive - a computed that reads them
  // directly (as the original component did) never re-evaluates after the
  // canvas element itself is created, even when the drawn image changes
  // size. Updating these refs explicitly in loadImageToCanvas() gives
  // canvasMetrics a real reactive dependency to key off.
  const imageWidth = ref(0)
  const imageHeight = ref(0)

  const canvasMetrics = computed(() => {
    if (!canvas.value || imageWidth.value === 0) return null
    return {
      width: imageWidth.value,
      height: imageHeight.value,
      shortSide: Math.min(imageWidth.value, imageHeight.value),
    }
  })

  const processingSettings = computed(() => {
    if (!canvasMetrics.value) return null
    const { shortSide } = canvasMetrics.value
    return {
      mosaicSize: Math.max(1, Math.floor(shortSide / 80)),
      blurRadius: Math.max(2, Math.floor(shortSide / 100)),
      lineWidth: Math.max(4, Math.floor(shortSide / 150)),
    }
  })

  // Cache for coordinate calculations, shared with useAreaSelection via the
  // getCanvasRect/getScale accessors below.
  let canvasRect: DOMRect | null = null
  let scaleX = 1
  let scaleY = 1

  const updateCanvasMetrics = () => {
    if (!canvas.value) return
    canvasRect = canvas.value.getBoundingClientRect()
    scaleX = canvas.value.width / canvasRect.width
    scaleY = canvas.value.height / canvasRect.height
  }

  const getCanvasRect = () => canvasRect
  const getScale = () => ({ scaleX, scaleY })

  const getCtx = () => ctx
  const getOriginalImageData = () => originalImageData
  const setOriginalImageData = (data: ImageData | null) => {
    originalImageData = data
  }
  const getCurrentImage = () => currentImage

  const loadImageToCanvas = (
    imageSrc: string,
    callbacks: LoadImageCallbacks = {}
  ) => {
    if (!canvas.value) return

    const img = new Image()
    img.onload = async () => {
      try {
        // Resize image if needed (max RESIZE_MAX_DIMENSION px on longest side)
        const processedImg = await resizeImageIfNeeded(img)

        currentImage = processedImg
        const canvasEl = canvas.value!
        ctx = canvasEl.getContext('2d')!

        // Use processed image dimensions
        canvasEl.width = processedImg.width
        canvasEl.height = processedImg.height
        imageWidth.value = processedImg.width
        imageHeight.value = processedImg.height

        ctx.drawImage(
          processedImg,
          0,
          0,
          processedImg.width,
          processedImg.height
        )
        originalImageData = ctx.getImageData(
          0,
          0,
          processedImg.width,
          processedImg.height
        )

        // Update canvas metrics for optimized coordinate calculations
        updateCanvasMetrics()

        callbacks.onSuccess?.()
      } catch {
        callbacks.onProcessError?.()
      }
    }
    img.onerror = () => {
      callbacks.onLoadError?.()
    }
    img.src = imageSrc
  }

  const redrawCanvas = (selection: SelectionArea, isSelecting: boolean) => {
    if (!ctx || !originalImageData) return

    // Always restore the current state (which includes any edits)
    ctx.putImageData(originalImageData, 0, 0)

    // Show dashed outline only while dragging
    if (isSelecting) {
      ctx.strokeStyle = '#ff0000'
      // Use computed line width for better performance
      const lineWidth = processingSettings.value?.lineWidth || 4
      ctx.lineWidth = lineWidth
      ctx.setLineDash([5, 5])

      const width = selection.endX - selection.startX
      const height = selection.endY - selection.startY

      ctx.strokeRect(selection.startX, selection.startY, width, height)
      ctx.setLineDash([])
    }
  }

  const resetToOriginal = () => {
    if (!ctx || !currentImage) return false

    // Redraw the original image
    const canvasEl = canvas.value!
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
    ctx.drawImage(currentImage, 0, 0, canvasEl.width, canvasEl.height)
    originalImageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
    return true
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (canvas.value) {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasMetrics()
      })
      resizeObserver.observe(canvas.value)

      // Initial metrics update
      updateCanvasMetrics()
    }
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return {
    canvas,
    canvasContainer,
    canvasMetrics,
    processingSettings,
    updateCanvasMetrics,
    getCanvasRect,
    getScale,
    getCtx,
    getOriginalImageData,
    setOriginalImageData,
    getCurrentImage,
    loadImageToCanvas,
    redrawCanvas,
    resetToOriginal,
  }
}
