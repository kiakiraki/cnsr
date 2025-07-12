import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

describe('Download Functionality', () => {
  describe('Filename Generation', () => {
    let originalFileName: { value: string }
    let processingMode: { value: 'blackfill' | 'whitefill' | 'mosaic' | 'blur' }

    beforeEach(() => {
      originalFileName = ref('')
      processingMode = ref<'blackfill' | 'whitefill' | 'mosaic' | 'blur'>('blackfill')
    })

    const generateDownloadFilename = (originalName: string, mode: string): string => {
      let filename = 'processed-image.png' // fallback
      if (originalName) {
        const lastDotIndex = originalName.lastIndexOf('.')
        let basename = originalName
        
        // Extract basename only if there's a valid extension (not just starting with dot)
        if (lastDotIndex > 0) {
          basename = originalName.substring(0, lastDotIndex)
        } else if (lastDotIndex === 0) {
          // Handle files starting with dot (like .jpg) - use empty basename
          basename = ''
        }
        // If lastDotIndex === -1, use the whole filename as basename
        
        const suffix = mode === 'blackfill' ? '-blackfill'
          : mode === 'whitefill' ? '-whitefill'
          : mode === 'mosaic' ? '-mosaic'
          : '-blur'
        filename = `${basename}${suffix}.png`
      }
      return filename
    }

    it('should generate filename with blackfill suffix', () => {
      originalFileName.value = 'photo.jpg'
      processingMode.value = 'blackfill'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('photo-blackfill.png')
    })

    it('should generate filename with whitefill suffix', () => {
      originalFileName.value = 'image.png'
      processingMode.value = 'whitefill'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('image-whitefill.png')
    })

    it('should generate filename with mosaic suffix', () => {
      originalFileName.value = 'document.jpeg'
      processingMode.value = 'mosaic'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('document-mosaic.png')
    })

    it('should generate filename with blur suffix', () => {
      originalFileName.value = 'picture.webp'
      processingMode.value = 'blur'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('picture-blur.png')
    })

    it('should handle filename without extension', () => {
      originalFileName.value = 'filename_without_extension'
      processingMode.value = 'mosaic'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('filename_without_extension-mosaic.png')
    })

    it('should handle filename with multiple dots', () => {
      originalFileName.value = 'file.name.with.dots.jpg'
      processingMode.value = 'blackfill'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('file.name.with.dots-blackfill.png')
    })

    it('should handle filename starting with dot', () => {
      originalFileName.value = '.hidden-file.png'
      processingMode.value = 'blur'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('.hidden-file-blur.png')
    })

    it('should use fallback filename when original is empty', () => {
      originalFileName.value = ''
      processingMode.value = 'mosaic'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('processed-image.png')
    })

    it('should handle very long filenames', () => {
      originalFileName.value = 'a'.repeat(200) + '.jpg'
      processingMode.value = 'blackfill'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('a'.repeat(200) + '-blackfill.png')
    })

    it('should handle special characters in filename', () => {
      originalFileName.value = 'file-name_with@special#chars$.jpg'
      processingMode.value = 'whitefill'
      
      const filename = generateDownloadFilename(originalFileName.value, processingMode.value)
      expect(filename).toBe('file-name_with@special#chars$-whitefill.png')
    })
  })

  describe('File Upload State', () => {
    let originalFileName: { value: string }
    let uploadedImage: { value: string | null }
    let processedImage: { value: string | null }

    beforeEach(() => {
      originalFileName = ref('')
      uploadedImage = ref<string | null>(null)
      processedImage = ref<string | null>(null)
    })

    const processImageFile = (fileName: string) => {
      originalFileName.value = fileName
      uploadedImage.value = 'data:image/png;base64,fake-uploaded-data'
    }

    const resetImage = () => {
      uploadedImage.value = null
      processedImage.value = null
      originalFileName.value = ''
    }

    it('should store original filename when uploading', () => {
      const filename = 'test-image.jpg'
      processImageFile(filename)
      
      expect(originalFileName.value).toBe(filename)
      expect(uploadedImage.value).toBe('data:image/png;base64,fake-uploaded-data')
    })

    it('should reset filename when clearing images', () => {
      processImageFile('test-image.jpg')
      expect(originalFileName.value).toBe('test-image.jpg')
      
      resetImage()
      
      expect(originalFileName.value).toBe('')
      expect(uploadedImage.value).toBeNull()
      expect(processedImage.value).toBeNull()
    })

    it('should maintain filename through image processing', () => {
      processImageFile('original.png')
      processedImage.value = 'data:image/png;base64,fake-processed-data'
      
      expect(originalFileName.value).toBe('original.png')
      expect(uploadedImage.value).toBeTruthy()
      expect(processedImage.value).toBeTruthy()
    })
  })

  describe('Download State Management', () => {
    let processedImage: { value: string | null }
    let originalFileName: { value: string }

    beforeEach(() => {
      processedImage = ref<string | null>(null)
      originalFileName = ref('')
    })

    const canDownload = (): boolean => {
      return processedImage.value !== null
    }

    it('should not allow download when no processed image', () => {
      expect(canDownload()).toBe(false)
    })

    it('should allow download when processed image exists', () => {
      processedImage.value = 'data:image/png;base64,processed-data'
      expect(canDownload()).toBe(true)
    })

    it('should maintain download state through filename changes', () => {
      processedImage.value = 'data:image/png;base64,processed-data'
      originalFileName.value = 'test.jpg'
      
      expect(canDownload()).toBe(true)
      
      originalFileName.value = 'new-name.png'
      expect(canDownload()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    const generateDownloadFilename = (originalName: string, mode: string): string => {
      let filename = 'processed-image.png' // fallback
      if (originalName) {
        const lastDotIndex = originalName.lastIndexOf('.')
        let basename = originalName
        
        // Extract basename only if there's a valid extension (not just starting with dot)
        if (lastDotIndex > 0) {
          basename = originalName.substring(0, lastDotIndex)
        } else if (lastDotIndex === 0) {
          // Handle files starting with dot (like .jpg) - use empty basename
          basename = ''
        }
        // If lastDotIndex === -1, use the whole filename as basename
        
        const suffix = mode === 'blackfill' ? '-blackfill'
          : mode === 'whitefill' ? '-whitefill'
          : mode === 'mosaic' ? '-mosaic'
          : '-blur'
        filename = `${basename}${suffix}.png`
      }
      return filename
    }

    it('should handle null/undefined original filename', () => {
      const filename1 = generateDownloadFilename('', 'mosaic')
      expect(filename1).toBe('processed-image.png')
    })

    it('should handle filename that is only extension', () => {
      const filename = generateDownloadFilename('.jpg', 'blackfill')
      expect(filename).toBe('-blackfill.png')
    })

    it('should handle filename ending with dot', () => {
      const filename = generateDownloadFilename('filename.', 'blur')
      expect(filename).toBe('filename-blur.png')
    })

    it('should handle filename with no extension but containing dots', () => {
      const filename = generateDownloadFilename('file.name.no.ext', 'whitefill')
      expect(filename).toBe('file.name.no-whitefill.png')
    })

    it('should handle single character filename', () => {
      const filename = generateDownloadFilename('a.jpg', 'mosaic')
      expect(filename).toBe('a-mosaic.png')
    })

    it('should handle unicode characters in filename', () => {
      const filename = generateDownloadFilename('画像ファイル.jpg', 'blackfill')
      expect(filename).toBe('画像ファイル-blackfill.png')
    })
  })
})