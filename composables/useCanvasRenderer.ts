import { ref, computed, onMounted, onUnmounted } from 'vue'
import { resizeImageIfNeeded, type DecodedImage } from './useImageUpload'
import type { SelectionArea } from './useAreaSelection'

export interface LoadImageCallbacks {
  /** The <img> element itself failed to decode/load (data URL fallback path only). */
  onLoadError?: () => void
  /** Resizing/drawing the successfully-decoded image failed. */
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
  // Transparent canvas stacked on top of `canvas`, used to draw the
  // in-progress drag-selection rectangle. Keeping selection visuals off the
  // main canvas means dragging never needs to touch (let alone
  // putImageData-restore) the full image data.
  const overlayCanvas = ref<HTMLCanvasElement>()

  let ctx: CanvasRenderingContext2D | null = null
  let overlayCtx: CanvasRenderingContext2D | null = null
  let originalImageData: ImageData | null = null
  let currentImage: DecodedImage | HTMLCanvasElement | null = null

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

  /** Sizes the overlay canvas to match the main canvas and (re)creates its
   * 2D context. Called whenever the main canvas itself is (re)sized. */
  const syncOverlaySize = (width: number, height: number) => {
    if (!overlayCanvas.value) return
    overlayCanvas.value.width = width
    overlayCanvas.value.height = height
    overlayCtx = overlayCanvas.value.getContext('2d')
  }

  const drawDecodedImage = (
    source: DecodedImage,
    callbacks: LoadImageCallbacks
  ) => {
    try {
      const resized = resizeImageIfNeeded(source)

      currentImage = resized.image
      const canvasEl = canvas.value!
      ctx = canvasEl.getContext('2d')!

      canvasEl.width = resized.width
      canvasEl.height = resized.height
      imageWidth.value = resized.width
      imageHeight.value = resized.height
      syncOverlaySize(resized.width, resized.height)

      ctx.drawImage(resized.image, 0, 0, resized.width, resized.height)
      originalImageData = ctx.getImageData(0, 0, resized.width, resized.height)

      // Update canvas metrics for optimized coordinate calculations
      updateCanvasMetrics()

      callbacks.onSuccess?.()
    } catch {
      callbacks.onProcessError?.()
    }
  }

  const loadImageToCanvas = (
    source: ImageBitmap | string,
    callbacks: LoadImageCallbacks = {}
  ) => {
    if (!canvas.value) return

    if (typeof source === 'string') {
      // Fallback decode path (data URL) - only taken when createImageBitmap
      // isn't available (see useImageUpload.processImageFile).
      const img = new Image()
      img.onload = () => {
        drawDecodedImage(img, callbacks)
      }
      img.onerror = () => {
        callbacks.onLoadError?.()
      }
      img.src = source
      return
    }

    // Fast path: already-decoded ImageBitmap, no Base64 involved.
    drawDecodedImage(source, callbacks)
  }

  const redrawCanvas = (selection: SelectionArea, isSelecting: boolean) => {
    if (!overlayCtx || !canvas.value) return

    // Only the overlay is touched here - the main canvas (and its cached
    // originalImageData) is never written to while dragging, unlike the
    // previous implementation which putImageData'd the full image every
    // frame just to erase the previous selection rectangle.
    overlayCtx.clearRect(0, 0, canvas.value.width, canvas.value.height)

    if (isSelecting) {
      overlayCtx.strokeStyle = '#ff0000'
      // Use computed line width for better performance
      const lineWidth = processingSettings.value?.lineWidth || 4
      overlayCtx.lineWidth = lineWidth
      overlayCtx.setLineDash([5, 5])

      const width = selection.endX - selection.startX
      const height = selection.endY - selection.startY

      overlayCtx.strokeRect(selection.startX, selection.startY, width, height)
      overlayCtx.setLineDash([])
    }
  }

  /** Clears any selection rectangle left on the overlay canvas. */
  const clearOverlay = () => {
    if (!overlayCtx || !canvas.value) return
    overlayCtx.clearRect(0, 0, canvas.value.width, canvas.value.height)
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
    overlayCanvas,
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
    clearOverlay,
    resetToOriginal,
  }
}
