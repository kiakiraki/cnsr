// Test setup file
import { vi } from 'vitest'

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
global.Image = vi.fn(() => ({
  src: '',
  onload: null,
  width: 100,
  height: 100,
})) as unknown as typeof Image

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')

// Mock Touch API
global.Touch = class Touch {
  identifier: number
  target: EventTarget
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  screenX: number
  screenY: number
  radiusX: number
  radiusY: number
  rotationAngle: number
  force: number

  constructor(init: TouchInit) {
    this.identifier = init.identifier || 1
    this.target = init.target || document.body
    this.clientX = init.clientX || 0
    this.clientY = init.clientY || 0
    this.pageX = init.pageX || 0
    this.pageY = init.pageY || 0
    this.screenX = init.screenX || 0
    this.screenY = init.screenY || 0
    this.radiusX = init.radiusX || 0
    this.radiusY = init.radiusY || 0
    this.rotationAngle = init.rotationAngle || 0
    this.force = init.force || 0
  }
} as unknown as typeof Touch

// Mock TouchEvent
global.TouchEvent = class TouchEvent extends Event {
  touches: TouchList
  targetTouches: TouchList
  changedTouches: TouchList

  constructor(type: string, init: TouchEventInit = {}) {
    super(type)
    this.touches = (init.touches || []) as unknown as TouchList
    this.targetTouches = (init.targetTouches || []) as unknown as TouchList
    this.changedTouches = (init.changedTouches || []) as unknown as TouchList
  }
} as unknown as typeof TouchEvent

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
