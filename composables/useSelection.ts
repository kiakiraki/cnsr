import { ref, shallowRef } from 'vue'
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
  canvasMetrics: Ref<{
    width: number
    height: number
    scaleX: number
    scaleY: number
  } | null>,
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

  let animationFrameId: number | null = null

  const getEventPosition = (event: MouseEvent | TouchEvent) => {
    if (!canvasMetrics.value) return { x: 0, y: 0 }
    const canvasEl = canvas.value!
    const rect = canvasEl.getBoundingClientRect()
    const { scaleX, scaleY } = canvasMetrics.value

    let clientX: number, clientY: number
    if (event instanceof MouseEvent) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      const touch = event.touches[0] || event.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
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

  const updateSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value) return
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    animationFrameId = requestAnimationFrame(() => {
      const pos = getEventPosition(event)
      selection.value = {
        ...selection.value,
        endX: pos.x,
        endY: pos.y,
      }
      options.onSelectionUpdate()
      animationFrameId = null
    })
  }

  const endSelection = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    if (!isSelecting.value) return

    // **THE FIX**: Cancel any pending frame to prevent redraw race condition
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    isSelecting.value = false
    const selWidth = Math.abs(selection.value.endX - selection.value.startX)
    const selHeight = Math.abs(selection.value.endY - selection.value.startY)

    if (selWidth > 5 && selHeight > 5) {
      options.onSelectionEnd(selection.value)
    }

    selection.value = { ...selection.value, active: false }
  }

  return {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
  }
}
