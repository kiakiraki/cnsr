import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// Longest side (px) an uploaded image is downscaled to before it is drawn
// onto the canvas.
export const RESIZE_MAX_DIMENSION = 1920

// How long an error banner stays visible before auto-dismissing.
export const ERROR_DISPLAY_MS = 5000

/**
 * Downscales an image so its longest side is at most RESIZE_MAX_DIMENSION,
 * preserving aspect ratio. Resolves with the original image unchanged if it
 * is already small enough.
 */
export function resizeImageIfNeeded(
  img: HTMLImageElement
): Promise<HTMLImageElement> {
  const maxDimension = Math.max(img.width, img.height)

  if (maxDimension <= RESIZE_MAX_DIMENSION) {
    return Promise.resolve(img) // No resizing needed
  }

  return new Promise((resolve, reject) => {
    // Calculate new dimensions maintaining aspect ratio
    const ratio = RESIZE_MAX_DIMENSION / maxDimension
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
    resizedImg.onerror = () =>
      reject(new Error('リサイズ後の画像の読み込みに失敗しました'))
    // PNG形式で透過情報（アルファチャンネル）を保持する
    resizedImg.src = resizeCanvas.toDataURL('image/png')
  })
}

export interface UseImageUploadOptions {
  /** Called once the uploaded image data URL is ready to be drawn. */
  onImageReady?: (dataUrl: string) => void
  /** Called after this composable's own state has been cleared by resetImage(). */
  onReset?: () => void
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const fileInput = ref<HTMLInputElement>()
  const uploadedImage = ref<string | null>(null)
  const processedImage = ref<string | null>(null)
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
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      uploadedImage.value = dataUrl
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
    uploadedImage.value = null
    processedImage.value = null
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
    processedImage,
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
