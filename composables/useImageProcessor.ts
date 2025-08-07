import type { Ref } from 'vue'
import type { SelectionArea } from './useSelection'

export type ProcessingMode = 'blackfill' | 'whitefill' | 'mosaic' | 'blur'

export function useImageProcessor(
  canvas: Ref<HTMLCanvasElement | undefined>,
  options: {
    pushStateToUndoStack: (state: ImageData) => void
  }
) {
  let ctx: CanvasRenderingContext2D | null = null
  let originalImageData: ImageData | null = null
  let currentImage: HTMLImageElement | null = null

  const getContext = (): CanvasRenderingContext2D | null => {
    if (ctx) return ctx
    if (canvas.value) {
      ctx = canvas.value.getContext('2d')
    }
    return ctx
  }

  const loadImage = async (imageSrc: string): Promise<HTMLImageElement> => {
    const img = new Image()
    img.src = imageSrc

    await new Promise(resolve => {
      img.onload = resolve
    })

    const processedImg = await resizeImageIfNeeded(img)
    currentImage = processedImg
    const canvasEl = canvas.value!
    const context = getContext()!

    canvasEl.width = processedImg.width
    canvasEl.height = processedImg.height

    context.drawImage(
      processedImg,
      0,
      0,
      processedImg.width,
      processedImg.height
    )
    originalImageData = context.getImageData(
      0,
      0,
      processedImg.width,
      processedImg.height
    )
    return processedImg
  }

  const resizeImageIfNeeded = (
    img: HTMLImageElement
  ): Promise<HTMLImageElement> => {
    const maxSize = 1920
    const maxDimension = Math.max(img.width, img.height)

    if (maxDimension <= maxSize) {
      return Promise.resolve(img)
    }

    return new Promise(resolve => {
      const ratio = maxSize / maxDimension
      const newWidth = Math.floor(img.width * ratio)
      const newHeight = Math.floor(img.height * ratio)

      const resizeCanvas = document.createElement('canvas')
      const resizeCtx = resizeCanvas.getContext('2d')!
      resizeCanvas.width = newWidth
      resizeCanvas.height = newHeight

      resizeCtx.drawImage(img, 0, 0, newWidth, newHeight)

      const resizedImg = new Image()
      resizedImg.onload = () => resolve(resizedImg)
      resizedImg.src = resizeCanvas.toDataURL('image/jpeg', 0.9)
    })
  }

  const redrawCanvasWithSelection = (selection: SelectionArea) => {
    const context = getContext()
    if (!context || !originalImageData) return

    context.putImageData(originalImageData, 0, 0)

    if (selection.active) {
      context.strokeStyle = '#ff0000'
      const shortSide = Math.min(canvas.value!.width, canvas.value!.height)
      context.lineWidth = Math.max(4, Math.floor(shortSide / 150))
      context.setLineDash([5, 5])
      const width = selection.endX - selection.startX
      const height = selection.endY - selection.startY
      context.strokeRect(selection.startX, selection.startY, width, height)
      context.setLineDash([])
    }
  }

  const applyProcessing = (mode: ProcessingMode, selection: SelectionArea) => {
    const context = getContext()
    if (!context || !originalImageData) return

    // Save a copy of the current state to the undo stack
    const currentState = new ImageData(
      new Uint8ClampedArray(originalImageData.data),
      originalImageData.width,
      originalImageData.height
    )
    options.pushStateToUndoStack(currentState)

    const startX = Math.min(selection.startX, selection.endX)
    const startY = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    if (width === 0 || height === 0) return

    const shortSide = Math.min(canvas.value!.width, canvas.value!.height)

    if (mode === 'blackfill') {
      context.fillStyle = '#000000'
      context.fillRect(startX, startY, width, height)
    } else if (mode === 'whitefill') {
      context.fillStyle = '#ffffff'
      context.fillRect(startX, startY, width, height)
    } else if (mode === 'blur') {
      const blurRadius = Math.max(2, Math.floor(shortSide / 100))
      context.save()
      context.beginPath()
      context.rect(startX, startY, width, height)
      context.clip()
      context.filter = `blur(${blurRadius}px)`
      context.drawImage(canvas.value!, 0, 0)
      context.restore()
    } else if (mode === 'mosaic') {
      // --- Optimized fillRect Mosaic Algorithm ---
      const mosaicSize = Math.max(4, Math.floor(shortSide / 80))
      // Get the image data for the entire selection once to sample from.
      const regionData = context.getImageData(startX, startY, width, height)
      const data = regionData.data

      for (let y = 0; y < height; y += mosaicSize) {
        for (let x = 0; x < width; x += mosaicSize) {
          // Get a sample pixel from the center of the block, relative to the region.
          const sampleX = x + Math.floor(mosaicSize / 2)
          const sampleY = y + Math.floor(mosaicSize / 2)

          if (sampleX < width && sampleY < height) {
            const sampleIndex = (sampleY * width + sampleX) * 4
            const r = data[sampleIndex]
            const g = data[sampleIndex + 1]
            const b = data[sampleIndex + 2]

            // Fill the block with the sampled color.
            context.fillStyle = `rgb(${r}, ${g}, ${b})`
            const blockWidth = Math.min(mosaicSize, width - x)
            const blockHeight = Math.min(mosaicSize, height - y)
            context.fillRect(startX + x, startY + y, blockWidth, blockHeight)
          }
        }
      }
    }

    originalImageData = context.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
  }

  const restoreState = (state: ImageData) => {
    const context = getContext()
    if (!context) return
    context.putImageData(state, 0, 0)
    originalImageData = context.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
  }

  const resetToOriginal = () => {
    const context = getContext()
    if (!context || !currentImage) return
    context.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
    context.drawImage(
      currentImage,
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
    originalImageData = context.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
  }

  const getProcessedImage = (): string | null => {
    if (!canvas.value) return null
    return canvas.value.toDataURL()
  }

  return {
    loadImage,
    redrawCanvasWithSelection,
    applyProcessing,
    restoreState,
    resetToOriginal,
    getProcessedImage,
  }
}
