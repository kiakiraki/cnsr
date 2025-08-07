import { describe, it, expect } from 'vitest'
import { generateDownloadFilename } from '~/utils/filename'

describe('generateDownloadFilename Utility', () => {
  it('should generate filename with blackfill suffix', () => {
    const filename = generateDownloadFilename('photo.jpg', 'blackfill')
    expect(filename).toBe('photo-blackfill.png')
  })

  it('should generate filename with whitefill suffix', () => {
    const filename = generateDownloadFilename('image.png', 'whitefill')
    expect(filename).toBe('image-whitefill.png')
  })

  it('should generate filename with mosaic suffix', () => {
    const filename = generateDownloadFilename('document.jpeg', 'mosaic')
    expect(filename).toBe('document-mosaic.png')
  })

  it('should generate filename with blur suffix', () => {
    const filename = generateDownloadFilename('picture.webp', 'blur')
    expect(filename).toBe('picture-blur.png')
  })

  it('should handle filename without extension', () => {
    const filename = generateDownloadFilename(
      'filename_without_extension',
      'mosaic'
    )
    expect(filename).toBe('filename_without_extension-mosaic.png')
  })

  it('should handle filename with multiple dots', () => {
    const filename = generateDownloadFilename(
      'file.name.with.dots.jpg',
      'blackfill'
    )
    expect(filename).toBe('file.name.with.dots-blackfill.png')
  })

  it('should handle filename starting with a dot', () => {
    const filename = generateDownloadFilename('.hidden-file.png', 'blur')
    expect(filename).toBe('.hidden-file-blur.png')
  })

  it('should use fallback filename when original is empty', () => {
    const filename = generateDownloadFilename('', 'mosaic')
    expect(filename).toBe('processed-image.png')
  })

  it('should handle filename that is only an extension', () => {
    const filename = generateDownloadFilename('.jpg', 'blackfill')
    expect(filename).toBe('-blackfill.png')
  })

  it('should handle unicode characters in filename', () => {
    const filename = generateDownloadFilename('画像ファイル.jpg', 'blackfill')
    expect(filename).toBe('画像ファイル-blackfill.png')
  })
})
