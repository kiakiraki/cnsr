import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// Longest side (px) an uploaded image is downscaled to before it is drawn
// onto the canvas.
export const RESIZE_MAX_DIMENSION = 1920

// How long an error banner stays visible before auto-dismissing.
export const ERROR_DISPLAY_MS = 5000

/** Anything resizeImageIfNeeded can take as input: an already-decoded
 * bitmap (from createImageBitmap) or a loaded <img> element (fallback
 * decode path). Both expose plain numeric width/height. */
export type DecodedImage = HTMLImageElement | ImageBitmap

export interface ResizedImage {
  /** Directly usable as a drawImage source - a canvas when downscaled
   * (no toDataURL/Image round-trip needed), otherwise the original
   * decoded image unchanged. */
  image: DecodedImage | HTMLCanvasElement
  width: number
  height: number
}

/**
 * Downscales an image so its longest side is at most RESIZE_MAX_DIMENSION,
 * preserving aspect ratio. Returns the original image unchanged (wrapped
 * with its dimensions) if it is already small enough. Synchronous: when
 * resizing is needed, the resize canvas itself is returned as the drawable
 * image rather than being re-encoded through toDataURL/new Image.
 */
export function resizeImageIfNeeded(source: DecodedImage): ResizedImage {
  const width = source.width
  const height = source.height
  const maxDimension = Math.max(width, height)

  if (maxDimension <= RESIZE_MAX_DIMENSION) {
    return { image: source, width, height } // No resizing needed
  }

  // Calculate new dimensions maintaining aspect ratio
  const ratio = RESIZE_MAX_DIMENSION / maxDimension
  const newWidth = Math.floor(width * ratio)
  const newHeight = Math.floor(height * ratio)

  // Create canvas for resizing and use it directly as the drawable image -
  // no toDataURL()/new Image() round-trip through Base64 needed.
  const resizeCanvas = document.createElement('canvas')
  const resizeCtx = resizeCanvas.getContext('2d')!
  resizeCanvas.width = newWidth
  resizeCanvas.height = newHeight
  resizeCtx.drawImage(source, 0, 0, newWidth, newHeight)

  return { image: resizeCanvas, width: newWidth, height: newHeight }
}

export interface UseImageUploadOptions {
  /**
   * Called once the uploaded image is ready to be drawn. Receives an
   * ImageBitmap when createImageBitmap() decoded the file directly (no
   * Base64 involved), or a data URL string when falling back to
   * FileReader.readAsDataURL (e.g. in environments without
   * createImageBitmap, such as the jsdom test environment).
   */
  onImageReady?: (source: ImageBitmap | string) => void
  /** Called after this composable's own state has been cleared by resetImage(). */
  onReset?: () => void
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const fileInput = ref<HTMLInputElement>()
  // Whether an image has been uploaded. Booleanized rather than holding the
  // decoded/Base64 data itself - the template only ever needs truthiness
  // (v-if), and the actual image data now lives in useCanvasRenderer.
  const uploadedImage = ref(false)
  // Whether the canvas currently holds a downloadable (processed-or-loaded)
  // image. See useImageUpload's sibling composables for who flips this.
  const hasProcessedImage = ref(false)
  const originalFileName = ref<string>('')
  const isDragOver = ref(false)
  const errorMessage = ref<string | null>(null)

  // Holds the pending auto-dismiss timer so a fresh error can cancel the
  // previous one instead of leaving a stale timeout that clears a newer
  // message early.
  let errorTimeoutId: ReturnType<typeof setTimeout> | null = null

  const showError = (message: string) => {
    if (errorTimeoutId !== null) {
      clearTimeout(errorTimeoutId)
    }
    errorMessage.value = message
    errorTimeoutId = setTimeout(() => {
      errorMessage.value = null
      errorTimeoutId = null
    }, ERROR_DISPLAY_MS)
  }

  const processImageFile = (file: File) => {
    originalFileName.value = file.name

    // Fast path: decode straight from the File/Blob, skipping the
    // FileReader -> Base64 data URL -> <img> round-trip entirely.
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file)
        .then(bitmap => {
          uploadedImage.value = true
          nextTick(() => {
            options.onImageReady?.(bitmap)
          })
        })
        .catch(() => {
          showError('画像の読み込みに失敗しました')
        })
      return
    }

    // Fallback path (e.g. jsdom test environment / browsers without
    // createImageBitmap): read as a Base64 data URL as before.
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      uploadedImage.value = true
      nextTick(() => {
        options.onImageReady?.(dataUrl)
      })
    }
    reader.onerror = () => {
      showError('ファイルの読み込みに失敗しました')
    }
    reader.readAsDataURL(file)
  }

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showError('画像ファイルを選択してください')
      return
    }
    processImageFile(file)
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
    const file = files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        showError('画像ファイルを選択してください')
        return
      }
      processImageFile(file)
    }
  }

  // Handle paste events for clipboard image upload
  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item?.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) {
          processImageFile(file)
        }
        break
      }
    }
  }

  const resetImage = () => {
    uploadedImage.value = false
    hasProcessedImage.value = false
    originalFileName.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    options.onReset?.()
  }

  onMounted(() => {
    document.addEventListener('paste', handlePaste)
  })

  onUnmounted(() => {
    document.removeEventListener('paste', handlePaste)
    if (errorTimeoutId !== null) {
      clearTimeout(errorTimeoutId)
      errorTimeoutId = null
    }
  })

  return {
    fileInput,
    uploadedImage,
    hasProcessedImage,
    originalFileName,
    isDragOver,
    errorMessage,
    showError,
    handleFileUpload,
    processImageFile,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    resetImage,
  }
}
