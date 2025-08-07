import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSelection } from '~/composables/useSelection'

import type { Ref } from 'vue'

describe('useSelection Composable', () => {
  let mockCanvas: Ref<HTMLCanvasElement>
  let mockCanvasMetrics: Ref<{
    width: number
    height: number
    scaleX: number
    scaleY: number
  } | null>
  let mockRect: DOMRect

  beforeEach(() => {
    mockRect = {
      left: 10,
      top: 20,
      width: 400,
      height: 300,
      x: 10,
      y: 20,
      bottom: 320,
      right: 410,
      toJSON: () => ({}),
    }

    mockCanvas = ref({
      getBoundingClientRect: vi.fn(() => mockRect),
    })

    mockCanvasMetrics = ref({
      width: 800,
      height: 600,
      scaleX: 2,
      scaleY: 2,
    })
  })

  it('getEventPosition should calculate correct canvas coordinates for mouse events', () => {
    const { startSelection, selection } = useSelection(
      mockCanvas,
      mockCanvasMetrics,
      {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      }
    )

    const mouseEvent = new MouseEvent('mousedown', {
      clientX: 210, // 10 (rect.left) + 200 (offset)
      clientY: 170, // 20 (rect.top) + 150 (offset)
    })

    startSelection(mouseEvent)

    // Expected: x = (200 * 2) = 400, y = (150 * 2) = 300
    expect(selection.value.startX).toBe(400)
    expect(selection.value.startY).toBe(300)
  })

  it('getEventPosition should calculate correct canvas coordinates for touch events', () => {
    const { startSelection, selection } = useSelection(
      mockCanvas,
      mockCanvasMetrics,
      {
        onSelectionUpdate: vi.fn(),
        onSelectionEnd: vi.fn(),
      }
    )

    const touchEvent = new TouchEvent('touchstart', {
      touches: [
        new Touch({
          identifier: 1,
          target: document.body,
          clientX: 110, // 10 (rect.left) + 100 (offset)
          clientY: 120, // 20 (rect.top) + 100 (offset)
        }),
      ],
    })

    startSelection(touchEvent)

    // Expected: x = (100 * 2) = 200, y = (100 * 2) = 200
    expect(selection.value.startX).toBe(200)
    expect(selection.value.startY).toBe(200)
  })
})
