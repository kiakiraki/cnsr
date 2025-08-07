import type { Ref } from 'vue'
import type { SelectionArea } from './useSelection' // This will be created later

export type ProcessingMode = 'blackfill' | 'whitefill' | 'mosaic' | 'blur'

// Note: This composable will be tightly coupled with the component's state for now.
// A fuller refactor would make it more independent, but this is a step-by-step process.
export function useImageProcessor(
  canvas: Ref<HTMLCanvasElement | undefined>,
  processingMode: Ref<ProcessingMode>,
  selection: Ref<SelectionArea>,
  hooks: {
    onProcessingComplete: (processedImage: string) => void
    pushStateToUndoStack: (state: ImageData) => void
  }
) {
  let ctx: CanvasRenderingContext2D | null = null
  let originalImageData: ImageData | null = null
  let currentImage: HTMLImageElement | null = null

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

  const loadImageToCanvas = async (imageSrc: string) => {
    if (!canvas.value) return null

    const img = new Image()
    img.src = imageSrc
    await new Promise(resolve => {
      img.onload = resolve
    })

    const processedImg = await resizeImageIfNeeded(img)
    currentImage = processedImg
    const canvasEl = canvas.value
    ctx = canvasEl.getContext('2d')!
    canvasEl.width = processedImg.width
    canvasEl.height = processedImg.height
    ctx.drawImage(processedImg, 0, 0, processedImg.width, processedImg.height)
    originalImageData = ctx.getImageData(
      0,
      0,
      processedImg.width,
      processedImg.height
    )

    const canvasRect = canvas.value!.getBoundingClientRect()
    return {
      width: canvasEl.width,
      height: canvasEl.height,
      scaleX: canvasEl.width / canvasRect.width,
      scaleY: canvasEl.height / canvasRect.height,
    }
  }

  const redrawCanvas = () => {
    if (!ctx || !originalImageData) return
    ctx.putImageData(originalImageData, 0, 0)

    if (selection.value.active) {
      ctx.strokeStyle = '#ff0000'
      const shortSide = Math.min(canvas.value!.width, canvas.value!.height)
      ctx.lineWidth = Math.max(4, Math.floor(shortSide / 150))
      ctx.setLineDash([5, 5])
      const width = selection.value.endX - selection.value.startX
      const height = selection.value.endY - selection.value.startY
      ctx.strokeRect(
        selection.value.startX,
        selection.value.startY,
        width,
        height
      )
      ctx.setLineDash([])
    }
  }

  const applyProcessing = () => {
    if (!ctx || !originalImageData) return

    hooks.pushStateToUndoStack(originalImageData)

    const startX = Math.min(selection.value.startX, selection.value.endX)
    const startY = Math.min(selection.value.startY, selection.value.endY)
    const width = Math.abs(selection.value.endX - selection.value.startX)
    const height = Math.abs(selection.value.endY - selection.value.startY)
    if (width < 5 || height < 5) return

    const shortSide = Math.min(canvas.value!.width, canvas.value!.height)

    if (processingMode.value === 'blackfill') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(startX, startY, width, height)
    } else if (processingMode.value === 'whitefill') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(startX, startY, width, height)
    } else if (processingMode.value === 'blur') {
      const blurRadius = Math.max(2, Math.floor(shortSide / 100))
      ctx.save()
      ctx.beginPath()
      ctx.rect(startX, startY, width, height)
      ctx.clip()
      ctx.filter = `blur(${blurRadius}px)`
      ctx.drawImage(canvas.value!, 0, 0)
      ctx.restore()
    } else if (processingMode.value === 'mosaic') {
      const mosaicSize = Math.max(4, Math.floor(shortSide / 80))
      const regionData = ctx.getImageData(startX, startY, width, height)
      const data = regionData.data
      for (let y = 0; y < height; y += mosaicSize) {
        for (let x = 0; x < width; x += mosaicSize) {
          const sampleX = x + Math.floor(mosaicSize / 2)
          const sampleY = y + Math.floor(mosaicSize / 2)
          if (sampleX < width && sampleY < height) {
            const sampleIndex = (sampleY * width + sampleX) * 4
            const r = data[sampleIndex]
            const g = data[sampleIndex + 1]
            const b = data[sampleIndex + 2]
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
            ctx.fillRect(
              startX + x,
              startY + y,
              Math.min(mosaicSize, width - x),
              Math.min(mosaicSize, height - y)
            )
          }
        }
      }
    }

    originalImageData = ctx.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
    hooks.onProcessingComplete(canvas.value!.toDataURL())
  }

  const restoreState = (state: ImageData) => {
    if (!ctx) return
    ctx.putImageData(state, 0, 0)
    originalImageData = ctx.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
  }

  const resetToOriginal = () => {
    if (!ctx || !currentImage) return
    ctx.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
    ctx.drawImage(currentImage, 0, 0, canvas.value!.width, canvas.value!.height)
    originalImageData = ctx.getImageData(
      0,
      0,
      canvas.value!.width,
      canvas.value!.height
    )
  }

  return {
    loadImageToCanvas,
    redrawCanvas,
    applyProcessing,
    restoreState,
    resetToOriginal,
  }
}
