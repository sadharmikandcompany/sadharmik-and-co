import { useEffect } from "react"

// Alt+A submits the current form (e.g. "Create Purchase Order", "Create
// Order"). Unlike the Alt+S/Alt+P navigation shortcuts, this one deliberately
// fires even while focus is inside an input/textarea — the whole point is to
// let you finish and submit right after typing the last field.
export function useSaveShortcut(onSave: () => void, disabled?: boolean) {
  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault()
        onSave()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onSave, disabled])
}
