<template>
  <div class="image-mosaic-container">
    <div
      v-if="errorMessage"
      class="error-message"
      role="alert"
      aria-live="assertive"
    >
      <span>{{ errorMessage }}</span>
      <button
        type="button"
        class="error-close-btn"
        aria-label="エラーを閉じる"
        @click="errorMessage = null"
      >
        ×
      </button>
    </div>

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
            aria-hidden="true"
            focusable="false"
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
      <fieldset class="mode-selector">
        <legend class="mode-label">処理モード:</legend>
        <div class="radio-group">
          <label class="radio-option">
            <input
              v-model="processingMode"
              type="radio"
              name="processingMode"
              value="blackfill"
            />
            <span>黒塗り</span>
          </label>
          <label class="radio-option">
            <input
              v-model="processingMode"
              type="radio"
              name="processingMode"
              value="whitefill"
            />
            <span>白塗り</span>
          </label>
          <label class="radio-option">
            <input
              v-model="processingMode"
              type="radio"
              name="processingMode"
              value="mosaic"
            />
            <span>モザイク</span>
          </label>
          <label class="radio-option">
            <input
              v-model="processingMode"
              type="radio"
              name="processingMode"
              value="blur"
            />
            <span>ブラー</span>
          </label>
        </div>
      </fieldset>

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
          @click="handleUndoLastAction"
        >
          元に戻す
        </button>
        <button
          v-if="uploadedImage"
          class="btn btn-success"
          :disabled="!hasProcessedImage"
          :aria-describedby="
            !hasProcessedImage ? 'download-disabled-hint' : undefined
          "
          :title="
            !hasProcessedImage
              ? '範囲を選択して処理を適用すると有効になります'
              : undefined
          "
          @click="downloadImage"
        >
          ダウンロード
        </button>
        <span
          v-if="!hasProcessedImage"
          id="download-disabled-hint"
          class="sr-only"
        >
          範囲を選択して処理を適用するとダウンロードできます
        </span>
      </div>

      <div ref="canvasContainer" class="canvas-container">
        <div class="canvas-stack">
          <canvas
            ref="canvas"
            class="image-canvas"
            tabindex="0"
            role="application"
            aria-label="画像編集キャンバス。矢印キーで選択範囲を移動、Shift+矢印キーでサイズ変更、Enterで処理を適用、Escapeで選択解除"
            @mousedown="startSelection"
            @mousemove="updateSelection"
            @mouseup="endSelection"
            @touchstart="startSelection"
            @touchmove="updateSelection"
            @touchend="endSelection"
            @keydown="handleCanvasKeyDown"
          />
          <canvas ref="overlayCanvas" class="selection-overlay" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasRenderer } from '~/composables/useCanvasRenderer'
import { useUndoHistory } from '~/composables/useUndoHistory'
import { useImageProcessing } from '~/composables/useImageProcessing'
import {
  useAreaSelection,
  type SelectionArea,
} from '~/composables/useAreaSelection'
import { useImageUpload } from '~/composables/useImageUpload'
import { generateDownloadFilename } from '~/utils/downloadFilename'

// -- Canvas rendering (canvas element, 2D context, image data cache) --
const {
  canvas,
  canvasContainer,
  overlayCanvas,
  processingSettings,
  updateCanvasMetrics,
  getCanvasRect,
  getScale,
  getCtx,
  getOriginalImageData,
  setOriginalImageData,
  loadImageToCanvas,
  redrawCanvas,
  clearOverlay,
  resetToOriginal: resetCanvasToOriginal,
} = useCanvasRenderer()

// -- Undo history (region-diff stack + undo operation) --
const { canUndo, clearUndoHistory, pushUndoEntry, undoLastAction } =
  useUndoHistory({
    getCtx,
    getCanvas: () => canvas.value,
    setOriginalImageData,
  })

// -- Processing mode + blackfill/whitefill/mosaic/blur application --
const { processingMode, applyMosaic } = useImageProcessing({
  getCtx,
  getOriginalImageData,
  setOriginalImageData,
  getCanvas: () => canvas.value,
  getProcessingSettings: () => processingSettings.value,
  pushUndoEntry,
})

// Wired here (rather than inside useAreaSelection) so the selection
// composable stays decoupled from image-processing/undo concerns.
const handleSelectionEnd = (selection: SelectionArea) => {
  const applied = applyMosaic(selection)
  clearSelectionState()
  if (applied) {
    // Just flag that the canvas now has a downloadable image - the actual
    // (expensive, synchronous) PNG encode is deferred to downloadImage()
    // instead of running on every single edit.
    hasProcessedImage.value = true
  }
}

// -- Drag-to-select area on the canvas (mouse/touch) and keyboard-driven
// selection (arrow keys/Enter/Escape) - both share the same selection state.
const {
  startSelection,
  updateSelection,
  endSelection,
  clearSelectionState,
  handleCanvasKeyDown,
} = useAreaSelection({
  canvas,
  updateCanvasMetrics,
  getCanvasRect,
  getScale,
  redrawCanvas,
  clearOverlay,
  onSelectionEnd: handleSelectionEnd,
})

// -- Upload/drag-drop/paste + error banner --
const {
  fileInput,
  uploadedImage,
  hasProcessedImage,
  originalFileName,
  isDragOver,
  errorMessage,
  showError,
  handleFileUpload,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  resetImage,
} = useImageUpload({
  onImageReady: source => {
    loadImageToCanvas(source, {
      onLoadError: () => {
        showError(
          '画像の読み込みに失敗しました。対応していない形式の可能性があります'
        )
        uploadedImage.value = false
      },
      onProcessError: () => showError('画像の処理中にエラーが発生しました'),
      onSuccess: () => clearUndoHistory(),
    })
  },
  onReset: () => {
    clearSelectionState()
    clearUndoHistory()
  },
})

// -- Orchestration handlers spanning multiple composables --

const handleResetToOriginal = () => {
  if (!resetCanvasToOriginal()) return
  clearUndoHistory()
  clearSelectionState()
  hasProcessedImage.value = true
}

const handleUndoLastAction = () => {
  if (!undoLastAction()) return
  clearSelectionState()
  hasProcessedImage.value = true
}

const downloadImage = () => {
  if (!hasProcessedImage.value || !canvas.value) return

  const filename = generateDownloadFilename(
    originalFileName.value,
    processingMode.value
  )

  // Encode to PNG only now (once, on demand) via toBlob - which encodes
  // off the main thread in supporting browsers - rather than the
  // synchronous toDataURL() this used to run after every single edit.
  canvas.value.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.click()
    // ダウンロード開始前にBlob URLが無効化されるブラウザがあるため遅延解放
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
</script>

<style scoped>
.image-mosaic-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  transition: opacity 0.3s ease;
}

.error-close-btn {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}

.error-close-btn:hover {
  opacity: 0.7;
}

.error-close-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: 3px;
}

.upload-area {
  position: relative;
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

/* Visually hidden but still focusable/reachable by keyboard (sr-only
 * technique) - unlike display:none, this keeps the input in the Tab order
 * so Enter/Space (native label+input behavior) can open the file dialog. */
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Generic visually-hidden utility, used for text that should only be
 * exposed to assistive technology (e.g. the download button's disabled
 * reason). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.upload-label {
  cursor: pointer;
  display: block;
  width: 100%;
  height: 100%;
}

/* Visual focus ring on the label when the (visually hidden) file input
 * receives keyboard focus. */
.upload-area:focus-within .upload-label {
  outline: 3px solid #007bff;
  outline-offset: 2px;
  border-radius: 4px;
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
  /* #767676 keeps a >=4.5:1 contrast ratio against the white background. */
  color: #767676;
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
  /* #1e7e34 keeps a >=4.5:1 contrast ratio for the white label text
   * (the original #28a745 only reached ~3.1:1). */
  background-color: #1e7e34;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #196b2c;
}

.btn-success:disabled {
  background-color: #ccc;
  color: #666;
  cursor: not-allowed;
}

.btn-info {
  /* #128193 keeps a >=4.5:1 contrast ratio for the white label text
   * (the original #17a2b8 only reached ~3.0:1). */
  background-color: #128193;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #0e6978;
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
  /* Reset the browser default fieldset margin/min-width so it lays out
   * identically to the plain <div> it used to be. */
  min-width: 0;
  margin: 0 0 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.mode-label {
  /* Reset the browser default legend padding/border so it looks like the
   * plain <label> it used to be. */
  padding: 0;
  border: none;
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

/* Shrink-wraps its content (the main canvas), so the absolutely-positioned
 * overlay canvas below can size itself to exactly match the main canvas's
 * rendered box via width/height: 100%. */
.canvas-stack {
  position: relative;
  display: inline-block;
  line-height: 0;
  /* borderはstack側に付ける: canvasに付けるとオーバーレイ(100%幅)が
   * border込みの箱に伸ばされ、選択矩形の表示が微妙にズレるため */
  border: 1px solid #ddd;
  border-radius: 5px;
  overflow: hidden;
}

.image-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  cursor: crosshair;
  touch-action: none;
}

.image-canvas:focus-visible {
  outline: 3px solid #007bff;
  outline-offset: -3px;
}

/* Drag-selection rectangle is drawn here instead of on the main canvas, so
 * dragging never needs to putImageData the full image every frame. */
.selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
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
  .error-message {
    background-color: #4a1c1c;
    color: #f5c6cb;
    border-color: #6b2c2c;
  }

  .upload-area {
    border-color: #555;
    background-color: #2d2d2d;
  }

  .upload-content {
    color: #ccc;
  }

  .upload-hint {
    /* #a8a8a8 keeps a >=4.5:1 contrast ratio against the dark background. */
    color: #a8a8a8;
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

  .canvas-stack {
    border-color: #555;
  }
}
</style>
