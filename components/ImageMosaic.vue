<template>
  <div class="image-mosaic-container">
    <div
      v-if="!uploadedImage"
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @drop="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragenter.prevent="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <input
        id="imageUpload"
        ref="fileInput"
        type="file"
        accept="image/*"
        class="file-input"
        @change="handleFileUpload"
      />
      <label for="imageUpload" class="upload-label">
        <div class="upload-content">
          <svg
            class="upload-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>画像をアップロード</p>
          <p class="upload-hint">クリック または ドラッグ&ドロップ</p>
        </div>
      </label>
    </div>

    <div v-if="uploadedImage" class="image-editor">
      <div class="mode-selector">
        <label class="mode-label">処理モード:</label>
        <div class="radio-group">
          <label class="radio-option">
            <input v-model="processingMode" type="radio" value="blackfill" />
            <span>黒塗り</span>
          </label>
          <label class="radio-option">
            <input v-model="processingMode" type="radio" value="whitefill" />
            <span>白塗り</span>
          </label>
          <label class="radio-option">
            <input v-model="processingMode" type="radio" value="mosaic" />
            <span>モザイク</span>
          </label>
          <label class="radio-option">
            <input v-model="processingMode" type="radio" value="blur" />
            <span>ブラー</span>
          </label>
        </div>
      </div>

      <div class="editor-controls">
        <button class="btn btn-secondary" @click="resetImage">
          新しい画像
        </button>
        <button
          class="btn btn-info"
          :disabled="!canUndo"
          @click="resetToOriginal"
        >
          最初に戻す
        </button>
        <button
          class="btn btn-warning"
          :disabled="!canUndo"
          @click="undoLastAction"
        >
          元に戻す
        </button>
        <button
          v-if="uploadedImage"
          class="btn btn-success"
          :disabled="!processedImage"
          @click="downloadImage"
        >
          ダウンロード
        </button>
      </div>

      <div ref="canvasContainer" class="canvas-container">
        <canvas
          ref="canvas"
          class="image-canvas"
          @mousedown="startSelection"
          @mousemove="updateSelection"
          @mouseup="endSelection"
          @touchstart="startSelection"
          @touchmove="updateSelection"
          @touchend="endSelection"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

interface SelectionArea {
  startX: number
  startY: number
  endX: number
  endY: number
  active: boolean
}

const fileInput = ref<HTMLInputElement>()
const canvas = ref<HTMLCanvasElement>()
const canvasContainer = ref<HTMLDivElement>()
const uploadedImage = ref<string | null>(null)
const processedImage = ref<string | null>(null)
const hasSelection = ref(false)
const isSelecting = ref(false)
const canUndo = ref(false)
const undoStack = shallowRef<ImageData[]>([])
const MAX_UNDO_LEVELS = 16
const processingMode = ref<'blackfill' | 'whitefill' | 'mosaic' | 'blur'>(
  'blackfill'
)
const isDragOver = ref(false)

const selection = shallowRef<SelectionArea>({
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  active: false,
})

let ctx: CanvasRenderingContext2D | null = null
let originalImageData: ImageData | null = null
let currentImage: HTMLImageElement | null = null

// Computed properties for performance optimization
const canvasMetrics = computed(() => {
  if (!canvas.value) return null
  return {
    width: canvas.value.width,
    height: canvas.value.height,
    shortSide: Math.min(canvas.value.width, canvas.value.height),
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

// Cache for coordinate calculations
let canvasRect: DOMRect | null = null
let scaleX = 1,
  scaleY = 1

const updateCanvasMetrics = () => {
  if (!canvas.value) return
  canvasRect = canvas.value.getBoundingClientRect()
  scaleX = canvas.value.width / canvasRect.width
  scaleY = canvas.value.height / canvasRect.height
}

// Resize image if larger than 1920px on longest side
const resizeImageIfNeeded = (
  img: HTMLImageElement
): Promise<HTMLImageElement> => {
  const maxSize = 1920
  const maxDimension = Math.max(img.width, img.height)

  if (maxDimension <= maxSize) {
    return Promise.resolve(img) // No resizing needed
  }

  return new Promise(resolve => {
    // Calculate new dimensions maintaining aspect ratio
    const ratio = maxSize / maxDimension
    const newWidth = Math.floor(img.width * ratio)
    const newHeight = Math.floor(img.height * ratio)

    // Create canvas for resizing
    const resizeCanvas = document.createElement('canvas')
    const resizeCtx = resizeCanvas.getContext('2d')!
    resizeCanvas.width = newWidth
    resizeCanvas.height = newHeight

    // Draw resized image
    resizeCtx.drawImage(img, 0, 0, newWidth, newHeight)

    // Create new image from resized canvas
    const resizedImg = new Image()
    resizedImg.onload = () => resolve(resizedImg)
    resizedImg.src = resizeCanvas.toDataURL('image/jpeg', 0.9)
  })
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file && file.type.startsWith('image/')) {
    processImageFile(file)
  }
}

const processImageFile = (file: File) => {
  const reader = new FileReader()
  reader.onload = e => {
    uploadedImage.value = e.target?.result as string
    nextTick(() => {
      loadImageToCanvas()
    })
  }
  reader.readAsDataURL(file)
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // Only set isDragOver to false if we're leaving the upload area completely
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('image/')) {
      processImageFile(file)
    }
  }
}

const loadImageToCanvas = () => {
  if (!uploadedImage.value || !canvas.value) return

  const img = new Image()
  img.onload = async () => {
    try {
      // Resize image if needed (max 1920px on longest side)
      const processedImg = await resizeImageIfNeeded(img)

      currentImage = processedImg
      const canvasEl = canvas.value!
      ctx = canvasEl.getContext('2d')!

      // Use processed image dimensions
      canvasEl.width = processedImg.width
      canvasEl.height = processedImg.height

      ctx.drawImage(processedImg, 0, 0, processedImg.width, processedImg.height)
      originalImageData = ctx.getImageData(
        0,
        0,
        processedImg.width,
        processedImg.height
      )

      // Update canvas metrics for optimized coordinate calculations
      updateCanvasMetrics()

      // Initialize undo stack - start empty, first edit will add the original state
      undoStack.value = []
      canUndo.value = false
    } catch (error) {
      console.error('Error processing image:', error)
    }
  }
  img.src = uploadedImage.value
}

const getEventPosition = (event: MouseEvent | TouchEvent) => {
  // For touch events, always get fresh canvas metrics to ensure accuracy
  if (event instanceof TouchEvent || !canvasRect) {
    updateCanvasMetrics()
  }

  let clientX: number, clientY: number

  if (event instanceof MouseEvent) {
    clientX = event.clientX
    clientY = event.clientY
  } else {
    // For touch events, use the first touch point
    const touch = event.touches[0] || event.changedTouches[0]
    clientX = touch.clientX
    clientY = touch.clientY
  }

  const x = (clientX - canvasRect!.left) * scaleX
  const y = (clientY - canvasRect!.top) * scaleY

  return { x, y }
}

const startSelection = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()
  if (!canvas.value) return

  // Ensure canvas metrics are up to date for touch events
  if (event instanceof TouchEvent) {
    updateCanvasMetrics()
  }

  const pos = getEventPosition(event)
  selection.value = {
    startX: pos.x,
    startY: pos.y,
    endX: pos.x,
    endY: pos.y,
    active: true,
  }
  isSelecting.value = true
  hasSelection.value = false
}

// Throttling for better performance during selection
let lastUpdateTime = 0
let animationFrameId: number | null = null
const THROTTLE_INTERVAL = 16 // 60fps

const updateSelection = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()
  if (!isSelecting.value || !canvas.value) return

  const now = Date.now()
  if (now - lastUpdateTime < THROTTLE_INTERVAL && animationFrameId) return

  lastUpdateTime = now

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  animationFrameId = requestAnimationFrame(() => {
    const pos = getEventPosition(event)
    selection.value.endX = pos.x
    selection.value.endY = pos.y
    redrawCanvas()
    animationFrameId = null
  })
}

const endSelection = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()
  if (!isSelecting.value) return

  isSelecting.value = false
  hasSelection.value =
    Math.abs(selection.value.endX - selection.value.startX) > 5 &&
    Math.abs(selection.value.endY - selection.value.startY) > 5

  // Auto-apply processing if there's a valid selection
  if (hasSelection.value) {
    applyMosaic()
  }
}

const redrawCanvas = () => {
  if (!ctx || !originalImageData) return

  // Always restore the current state (which includes any edits)
  ctx.putImageData(originalImageData, 0, 0)

  // Show dashed outline only while dragging
  if (isSelecting.value) {
    ctx.strokeStyle = '#ff0000'
    // Use computed line width for better performance
    const lineWidth = processingSettings.value?.lineWidth || 4
    ctx.lineWidth = lineWidth
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

const applyMosaic = () => {
  if (!ctx || !originalImageData || !hasSelection.value) return

  // Save current state to undo stack before making changes (clean state without selection overlay)
  ctx.putImageData(originalImageData, 0, 0)
  const currentState = ctx.getImageData(
    0,
    0,
    canvas.value!.width,
    canvas.value!.height
  )

  // Add to undo stack and manage size limit
  undoStack.value.push(currentState)
  if (undoStack.value.length > MAX_UNDO_LEVELS) {
    undoStack.value.shift() // Remove oldest entry
  }

  const startX = Math.min(selection.value.startX, selection.value.endX)
  const startY = Math.min(selection.value.startY, selection.value.endY)
  const width = Math.abs(selection.value.endX - selection.value.startX)
  const height = Math.abs(selection.value.endY - selection.value.startY)

  if (processingMode.value === 'blackfill') {
    // Fill the selected area with black
    ctx.fillStyle = '#000000'
    ctx.fillRect(startX, startY, width, height)
  } else if (processingMode.value === 'whitefill') {
    // Fill the selected area with white
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(startX, startY, width, height)
  } else if (processingMode.value === 'mosaic') {
    // Apply mosaic effect using fillRect method for reliability
    const mosaicSize = processingSettings.value?.mosaicSize || 10

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
  } else if (processingMode.value === 'blur') {
    // Apply Gaussian blur effect using Canvas filter
    // Use computed blur radius for better performance
    const blurRadius = processingSettings.value?.blurRadius || 5

    // Save current context state
    ctx.save()

    // Create clipping path for selected region only
    ctx.beginPath()
    ctx.rect(startX, startY, width, height)
    ctx.clip()

    // Apply blur filter and redraw the entire canvas within clipped region
    ctx.filter = `blur(${blurRadius}px)`
    ctx.drawImage(canvas.value!, 0, 0)

    // Restore context state (removes clip and filter)
    ctx.restore()
  }

  // Clear selection state
  selection.value.active = false
  hasSelection.value = false
  isSelecting.value = false

  // Update original image data to include the black rectangle
  originalImageData = ctx.getImageData(
    0,
    0,
    canvas.value!.width,
    canvas.value!.height
  )

  // Enable undo after first operation
  canUndo.value = undoStack.value.length > 0

  // Save the processed image (without any selection overlay)
  processedImage.value = canvas.value!.toDataURL()
}

const undoLastAction = () => {
  if (!ctx || undoStack.value.length <= 0) return

  // Get the last saved state
  const previousState = undoStack.value.pop()!

  // Restore the previous state
  ctx.putImageData(previousState, 0, 0)
  originalImageData = ctx.getImageData(
    0,
    0,
    canvas.value!.width,
    canvas.value!.height
  )

  // Update undo availability - can undo if there are still states in stack
  canUndo.value = undoStack.value.length > 0

  // Clear selection state
  selection.value.active = false
  hasSelection.value = false
  isSelecting.value = false

  // Update processed image
  processedImage.value = canvas.value!.toDataURL()
}

const downloadImage = () => {
  if (!processedImage.value) return

  const link = document.createElement('a')
  link.download = 'mosaic-image.png'
  link.href = processedImage.value
  link.click()
}

const resetToOriginal = () => {
  if (!ctx || !currentImage) return

  // Redraw the original image
  const canvasEl = canvas.value!
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
  ctx.drawImage(currentImage, 0, 0, canvasEl.width, canvasEl.height)
  originalImageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)

  // Reset undo stack
  undoStack.value = []
  canUndo.value = false

  // Clear selection state
  selection.value.active = false
  hasSelection.value = false
  isSelecting.value = false

  // Update processed image
  processedImage.value = canvas.value!.toDataURL()
}

const resetImage = () => {
  uploadedImage.value = null
  processedImage.value = null
  hasSelection.value = false
  selection.value.active = false
  canUndo.value = false
  undoStack.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

onMounted(() => {
  // Set up ResizeObserver for automatic canvas metrics updates
  if (canvas.value) {
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasMetrics()
    })
    resizeObserver.observe(canvas.value)

    // Initial metrics update
    updateCanvasMetrics()
  }
})
</script>

<style scoped>
.image-mosaic-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 10px;
  padding: 40px;
  text-align: center;
  transition: border-color 0.3s ease;
}

.upload-area:hover {
  border-color: #007bff;
}

.upload-area.drag-over {
  border-color: #007bff;
  background-color: rgba(0, 123, 255, 0.1);
}

.file-input {
  display: none;
}

.upload-label {
  cursor: pointer;
  display: block;
  width: 100%;
  height: 100%;
}

.upload-content {
  color: #666;
}

.upload-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: #007bff;
}

.upload-hint {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

.image-editor {
  margin-top: 20px;
}

.editor-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
}

.btn-success:disabled {
  background-color: #ccc;
  color: #666;
  cursor: not-allowed;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn-info:disabled {
  background-color: #ccc;
  color: #666;
  cursor: not-allowed;
}

.btn-warning {
  background-color: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-warning:disabled {
  background-color: #ccc;
  color: #666;
  cursor: not-allowed;
}

.mode-selector {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.mode-label {
  display: block;
  font-weight: bold;
  margin-bottom: 10px;
  color: #495057;
}

.radio-group {
  display: flex;
  gap: 20px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #495057;
}

.radio-option input[type='radio'] {
  margin: 0;
  cursor: pointer;
}

.radio-option span {
  cursor: pointer;
}

.canvas-container {
  display: flex;
  justify-content: center;
  background-color: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  overflow: auto;
}

.image-canvas {
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 5px;
  cursor: crosshair;
  touch-action: none;
}

@media (max-width: 768px) {
  .image-mosaic-container {
    padding: 10px;
  }

  .upload-area {
    padding: 20px;
  }

  .upload-icon {
    width: 32px;
    height: 32px;
  }

  .editor-controls {
    justify-content: center;
  }

  .btn {
    padding: 8px 16px;
    font-size: 12px;
  }

  .canvas-container {
    padding: 10px;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-area {
    border-color: #555;
    background-color: #2d2d2d;
  }

  .upload-content {
    color: #ccc;
  }

  .upload-hint {
    color: #888;
  }

  .mode-selector {
    background-color: #2d2d2d;
    border-color: #555;
  }

  .mode-label {
    color: #ccc;
  }

  .radio-option {
    color: #ccc;
  }

  .canvas-container {
    background-color: #2d2d2d;
  }

  .image-canvas {
    border-color: #555;
  }
}
</style>
