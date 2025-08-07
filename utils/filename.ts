import type { ProcessingMode } from '~/composables/useImageProcessor'

export function generateDownloadFilename(
  originalName: string,
  mode: ProcessingMode
): string {
  const fallback = 'processed-image.png'
  if (!originalName) {
    return fallback
  }

  const lastDotIndex = originalName.lastIndexOf('.')
  let basename = originalName

  if (lastDotIndex > 0) {
    basename = originalName.substring(0, lastDotIndex)
  } else if (lastDotIndex === 0) {
    basename = ''
  }

  const suffix = `-${mode}`
  return `${basename}${suffix}.png`
}
