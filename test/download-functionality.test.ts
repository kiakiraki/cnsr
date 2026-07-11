import { describe, it, expect, beforeEach } from 'vitest'
import { generateDownloadFilename } from '../utils/downloadFilename'
import { useImageUpload } from '../composables/useImageUpload'

describe('Download Functionality', () => {
  describe('Filename Generation', () => {
    it('should generate filename with blackfill suffix', () => {
      expect(generateDownloadFilename('photo.jpg', 'blackfill')).toBe(
        'photo-blackfill.png'
      )
    })

    it('should generate filename with whitefill suffix', () => {
      expect(generateDownloadFilename('image.png', 'whitefill')).toBe(
        'image-whitefill.png'
      )
    })

    it('should generate filename with mosaic suffix', () => {
      expect(generateDownloadFilename('document.jpeg', 'mosaic')).toBe(
        'document-mosaic.png'
      )
    })

    it('should generate filename with blur suffix', () => {
      expect(generateDownloadFilename('picture.webp', 'blur')).toBe(
        'picture-blur.png'
      )
    })

    it('should handle filename without extension', () => {
      expect(
        generateDownloadFilename('filename_without_extension', 'mosaic')
      ).toBe('filename_without_extension-mosaic.png')
    })

    it('should handle filename with multiple dots', () => {
      expect(
        generateDownloadFilename('file.name.with.dots.jpg', 'blackfill')
      ).toBe('file.name.with.dots-blackfill.png')
    })

    it('should handle filename starting with dot', () => {
      expect(generateDownloadFilename('.hidden-file.png', 'blur')).toBe(
        '.hidden-file-blur.png'
      )
    })

    it('should use fallback filename when original is empty', () => {
      expect(generateDownloadFilename('', 'mosaic')).toBe(
        'processed-image.png'
      )
    })

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(200) + '.jpg'
      expect(generateDownloadFilename(longName, 'blackfill')).toBe(
        'a'.repeat(200) + '-blackfill.png'
      )
    })

    it('should handle special characters in filename', () => {
      expect(
        generateDownloadFilename(
          'file-name_with@special#chars$.jpg',
          'whitefill'
        )
      ).toBe('file-name_with@special#chars$-whitefill.png')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty original filename', () => {
      expect(generateDownloadFilename('', 'mosaic')).toBe(
        'processed-image.png'
      )
    })

    it('should handle filename that is only extension', () => {
      expect(generateDownloadFilename('.jpg', 'blackfill')).toBe(
        '-blackfill.png'
      )
    })

    it('should handle filename ending with dot', () => {
      expect(generateDownloadFilename('filename.', 'blur')).toBe(
        'filename-blur.png'
      )
    })

    it('should handle filename with no extension but containing dots', () => {
      expect(
        generateDownloadFilename('file.name.no.ext', 'whitefill')
      ).toBe('file.name.no-whitefill.png')
    })

    it('should handle single character filename', () => {
      expect(generateDownloadFilename('a.jpg', 'mosaic')).toBe(
        'a-mosaic.png'
      )
    })

    it('should handle unicode characters in filename', () => {
      expect(
        generateDownloadFilename('画像ファイル.jpg', 'blackfill')
      ).toBe('画像ファイル-blackfill.png')
    })

    it('should fall back to "-blur" suffix for an unrecognized mode', () => {
      expect(generateDownloadFilename('photo.jpg', 'unknown')).toBe(
        'photo-blur.png'
      )
    })
  })

  describe('File Upload State (via useImageUpload)', () => {
    it('should store the original filename when uploading', () => {
      const { originalFileName, uploadedImage, processImageFile } =
        useImageUpload()
      const file = new File(['fake'], 'test-image.jpg', {
        type: 'image/jpeg',
      })

      processImageFile(file)

      expect(originalFileName.value).toBe('test-image.jpg')
      // uploadedImage flips to true asynchronously once the image is
      // decoded (FileReader.onload in the jsdom fallback path used here);
      // synchronously it is still false.
      expect(uploadedImage.value).toBe(false)
    })

    it('should flip uploadedImage to true once decoding finishes', async () => {
      const { uploadedImage, processImageFile } = useImageUpload()
      const file = new File(['fake'], 'test-image.jpg', {
        type: 'image/jpeg',
      })

      processImageFile(file)
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(uploadedImage.value).toBe(true)
    })

    it('should reset filename and images when resetImage is called', () => {
      const {
        originalFileName,
        uploadedImage,
        hasProcessedImage,
        processImageFile,
        resetImage,
      } = useImageUpload()
      processImageFile(new File(['fake'], 'test-image.jpg', {}))
      expect(originalFileName.value).toBe('test-image.jpg')

      resetImage()

      expect(originalFileName.value).toBe('')
      expect(uploadedImage.value).toBe(false)
      expect(hasProcessedImage.value).toBe(false)
    })

    it('should invoke onReset after clearing its own state', () => {
      let stateAtResetTime: { uploadedImage: boolean } | null = null
      const { uploadedImage, resetImage } = useImageUpload({
        onReset: () => {
          stateAtResetTime = { uploadedImage: uploadedImage.value }
        },
      })
      uploadedImage.value = true

      resetImage()

      expect(stateAtResetTime).toEqual({ uploadedImage: false })
    })
  })

  describe('Download State Management', () => {
    let hasProcessedImage: { value: boolean }

    beforeEach(() => {
      hasProcessedImage = { value: false }
    })

    const canDownload = () => hasProcessedImage.value

    it('should not allow download when there is no processed image', () => {
      expect(canDownload()).toBe(false)
    })

    it('should allow download once a processed image exists', () => {
      hasProcessedImage.value = true
      expect(canDownload()).toBe(true)
    })

    it('should reflect hasProcessedImage from useImageUpload directly', () => {
      const { hasProcessedImage: flag } = useImageUpload()
      expect(flag.value).toBe(false)
      flag.value = true
      expect(flag.value).toBe(true)
    })
  })
})
