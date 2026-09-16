"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function CreateOrderShortcut() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "s" || e.key === "S")) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (target && target.isContentEditable)
        if (isEditable) return

        e.preventDefault()
        router.push("/dashboard/orders/new")
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return null
}
