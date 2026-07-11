// Pure filename-generation logic extracted from ImageMosaic.vue's
// downloadImage(). Kept dependency-free so it can be unit tested directly.
import type { ProcessingMode } from '../composables/useImageProcessing'

/**
 * Builds the download filename from the original uploaded filename and the
 * processing mode that was applied, e.g. ("photo.jpg", "mosaic") ->
 * "photo-mosaic.png". Falls back to "processed-image.png" when no original
 * filename is available.
 */
export function generateDownloadFilename(
  originalName: string,
  mode: ProcessingMode | string
): string {
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

    const suffix =
      mode === 'blackfill'
        ? '-blackfill'
        : mode === 'whitefill'
          ? '-whitefill'
          : mode === 'mosaic'
            ? '-mosaic'
            : '-blur'
    filename = `${basename}${suffix}.png`
  }

  return filename
}
