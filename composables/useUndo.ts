import { ref, shallowRef } from 'vue'

const MAX_UNDO_LEVELS = 16

export function useUndo() {
  const undoStack = shallowRef<ImageData[]>([])
  const canUndo = ref(false)

  const pushStateToUndoStack = (state: ImageData) => {
    const newStack = [...undoStack.value, state]
    if (newStack.length > MAX_UNDO_LEVELS) {
      newStack.shift()
    }
    undoStack.value = newStack
    canUndo.value = true
  }

  const popStateFromUndoStack = (): ImageData | undefined => {
    if (undoStack.value.length === 0) {
      return undefined
    }
    const newStack = [...undoStack.value]
    const lastState = newStack.pop()
    undoStack.value = newStack
    canUndo.value = newStack.length > 0
    return lastState
  }

  const clearUndoStack = () => {
    undoStack.value = []
    canUndo.value = false
  }

  return {
    canUndo,
    undoStack, // Exposing for potential debugging or advanced features, though not used by component
    pushStateToUndoStack,
    popStateFromUndoStack,
    clearUndoStack,
  }
}
