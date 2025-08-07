// Test setup file
import { vi } from 'vitest'

// Mock ImageData constructor for JSDOM environment
global.ImageData = class MockImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  colorSpace: 'srgb' = 'srgb'

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data
    this.width = width
    this.height = height || 0
  }
} as any

// Mock Canvas API
const mockCanvas = {
  getContext: vi.fn(() => ({
    fillStyle: '',
    fillRect: vi.fn(),
    strokeStyle: '',
    strokeRect: vi.fn(),
    lineWidth: 1,
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([255, 0, 0, 255]), // Red pixel
      width: 1,
      height: 1,
    })),
    putImageData: vi.fn(),
  })),
  width: 800,
  height: 600,
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  })),
}

// Mock HTML Canvas Element
global.HTMLCanvasElement = vi.fn(
  () => mockCanvas
) as unknown as typeof HTMLCanvasElement

// Mock FileReader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(),
  result: 'data:image/png;base64,fake-image-data',
  onload: null,
})) as unknown as typeof FileReader

// Mock Image
global.Image = vi.fn(() => {
  const img = {
    src: '',
    width: 100,
    height: 100,
    onload: null as (() => void) | null,
  }
  // Immediately trigger onload when it's set
  Object.defineProperty(img, 'onload', {
    set(value) {
      if (typeof value === 'function') {
        // Use a timeout to simulate async loading, preventing infinite loops
        // if onload is set inside another onload.
        setTimeout(value, 0)
      }
    },
  })
  return img
}) as unknown as typeof Image

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')

// Mock Touch API
global.Touch = vi.fn((init: TouchInit) => ({
  identifier: init.identifier || 1,
  target: init.target || document.body,
  clientX: init.clientX || 0,
  clientY: init.clientY || 0,
  pageX: init.pageX || 0,
  pageY: init.pageY || 0,
  screenX: init.screenX || 0,
  screenY: init.screenY || 0,
  radiusX: init.radiusX || 0,
  radiusY: init.radiusY || 0,
  rotationAngle: init.rotationAngle || 0,
  force: init.force || 0,
})) as unknown as typeof Touch

// Mock TouchEvent
global.TouchEvent = vi.fn((type: string, init: TouchEventInit) => ({
  type,
  touches: init.touches || [],
  targetTouches: init.targetTouches || [],
  changedTouches: init.changedTouches || [],
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
})) as unknown as typeof TouchEvent

// Mock document.createElement for download links
const mockElement = {
  download: '',
  href: '',
  click: vi.fn(),
}

const originalCreateElement = document.createElement
document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'a') {
    return mockElement as unknown as HTMLAnchorElement
  }
  return originalCreateElement.call(document, tagName)
})
