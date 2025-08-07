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
          <p class="upload-hint">
            クリック・ドラッグ&ドロップ・Ctrl+V（ペースト）
          </p>
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
          @click="handleResetToOriginal"
        >
          最初に戻す
        </button>
        <button
          class="btn btn-warning"
          :disabled="!canUndo"
          @click="handleUndo"
        >
          元に戻す
        </button>
        <button
          v-if="uploadedImage"
          class="btn btn-success"
          :disabled="!canUndo"
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useSelection } from '~/composables/useSelection'
import type { SelectionArea } from '~/composables/useSelection'
import { useUndo } from '~/composables/useUndo'
import { useImageProcessor } from '~/composables/useImageProcessor'
import type { ProcessingMode } from '~/composables/useImageProcessor'
import { generateDownloadFilename } from '~/utils/filename'

// --- Refs and State ---
const fileInput = ref<HTMLInputElement>()
const canvas = ref<HTMLCanvasElement>()
const canvasContainer = ref<HTMLDivElement>()

const uploadedImage = ref<string | null>(null)
const originalFileName = ref<string>('')
const processingMode = ref<ProcessingMode>('blackfill')
const isDragOver = ref(false)

// --- Composables ---
const { canUndo, pushStateToUndoStack, popStateFromUndoStack, clearUndoStack } =
  useUndo()

const {
  loadImage,
  redrawCanvasWithSelection,
  applyProcessing,
  restoreState,
  resetToOriginal,
  getProcessedImage,
} = useImageProcessor(canvas, {
  pushStateToUndoStack,
})

const {
  selection,
  startSelection,
  updateSelection,
  endSelection,
  resetSelection,
  updateCanvasMetrics,
} = useSelection(canvas, {
  onSelectionUpdate: () => {
    redrawCanvasWithSelection(selection.value)
  },
  onSelectionEnd: (sel: SelectionArea) => {
    applyProcessing(processingMode.value, sel)
    // After applying, redraw without the selection box
    redrawCanvasWithSelection({ ...sel, active: false })
  },
})

// --- Event Handlers ---
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && file.type.startsWith('image/')) {
    processImageFile(file)
  }
}

const processImageFile = (file: File) => {
  originalFileName.value = file.name
  const reader = new FileReader()
  reader.onload = e => {
    uploadedImage.value = e.target?.result as string
    nextTick(async () => {
      await loadImage(uploadedImage.value!)
      updateCanvasMetrics()
      clearUndoStack()
    })
  }
  reader.readAsDataURL(file)
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    processImageFile(file)
  }
}

const handlePaste = (event: ClipboardEvent) => {
  const item = event.clipboardData?.items[0]
  if (item && item.type.startsWith('image/')) {
    event.preventDefault()
    const file = item.getAsFile()
    if (file) {
      processImageFile(file)
    }
  }
}

const handleUndo = () => {
  const lastState = popStateFromUndoStack()
  if (lastState) {
    restoreState(lastState)
  }
}

const handleResetToOriginal = () => {
  resetToOriginal()
  clearUndoStack()
}

const downloadImage = () => {
  const dataUrl = getProcessedImage()
  if (!dataUrl) return

  const filename = generateDownloadFilename(
    originalFileName.value,
    processingMode.value
  )

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

const resetImage = () => {
  uploadedImage.value = null
  originalFileName.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  clearUndoStack()
  resetSelection()
}

// --- Drag and Drop State ---
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
}

// --- Lifecycle Hooks ---
onMounted(() => {
  if (canvas.value) {
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasMetrics()
    })
    resizeObserver.observe(canvas.value)
  }
  document.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
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
