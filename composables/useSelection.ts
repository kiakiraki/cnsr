import { ref, shallowRef, computed } from 'vue'
import type { Ref } from 'vue'

export interface SelectionArea {
  startX: number
  startY: number
  endX: number
  endY: number
  active: boolean
}

export function useSelection(
  canvas: Ref<HTMLCanvasElement | undefined>,
  options: {
    onSelectionUpdate: () => void
    onSelectionEnd: (selection: SelectionArea) => void
  }
) {
  const selection = shallowRef<SelectionArea>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    active: false,
  })
  const isSelecting = ref(false)

  let canvasRect: DOMRect | null = null
  let scaleX = 1
  let scaleY = 1

  const hasSelection = computed(() => {
    if (!selection.value.active) return false
    return (
      Math.abs(selection.value.endX - selection.value.startX) > 5 &&
      Math.abs(selection.value.endY - selection.value.startY) > 5
    )
  })

  const updateCanvasMetrics = () => {
    if (!canvas.value) return
    canvasRect = canvas.value.getBoundingClientRect()
    scaleX = canvas.value.width / canvasRect.width
    scaleY = canvas.value.height / canvasRect.height
  }

  const getEventPosition = (event: MouseEvent | TouchEvent) => {
    if (!canvasRect || event instanceof TouchEvent) {
      updateCanvasMetrics()
    }

    let clientX: number, clientY: number
    if (event instanceof MouseEvent) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      const touch = event.touches[0] || event.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    }

    const x = (clientX - canvasRect!.left) * scaleX
    const y = (clientY - canvasRect!.top) * scaleY

    return { x, y }
  }

  const startSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!canvas.value) return

    if (event instanceof MouseEvent) {
      updateCanvasMetrics()
    }

    const pos = getEventPosition(event)
    selection.value = {
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
      active: true,
    }
    isSelecting.value = true
  }

  let lastUpdateTime = 0
  let animationFrameId: number | null = null
  const THROTTLE_INTERVAL = 16 // 60fps

  const updateSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value || !canvas.value) return

    const now = Date.now()
    if (now - lastUpdateTime < THROTTLE_INTERVAL && animationFrameId) return
    lastUpdateTime = now

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }

    animationFrameId = requestAnimationFrame(() => {
      const pos = getEventPosition(event)
      selection.value.endX = pos.x
      selection.value.endY = pos.y
      options.onSelectionUpdate()
      animationFrameId = null
    })
  }

  const endSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value) return

    isSelecting.value = false
    if (hasSelection.value) {
      options.onSelectionEnd(selection.value)
    }
    // Reset selection activity after processing
    selection.value = { ...selection.value, active: false }
  }

  const resetSelection = () => {
    selection.value = { startX: 0, startY: 0, endX: 0, endY: 0, active: false }
    isSelecting.value = false
  }

  return {
    selection,
    isSelecting,
    hasSelection,
    startSelection,
    updateSelection,
    endSelection,
    resetSelection,
    updateCanvasMetrics,
  }
}
