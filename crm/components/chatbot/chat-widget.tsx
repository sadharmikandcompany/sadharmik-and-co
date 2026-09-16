"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Bot,
  X,
  Send,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  Volume2,
} from "lucide-react"
import { useGeminiLive, type LiveTool } from "@/hooks/use-gemini-live"
import { buildLiveSystemPrompt } from "@/lib/chatbot/system-prompt"

interface ChatMsg {
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatAction {
  type: "navigate" | "fill" | "click" | "reply"
  path?: string
  selector?: string
  value?: string
  text?: string
}

interface FormFieldSnapshot {
  selector: string
  label: string
  type: string
  currentValue: string
  options?: string[]
}

const SYSTEM_PROMPT_LIVE = buildLiveSystemPrompt()

const LIVE_TOOLS: LiveTool[] = [
  {
    name: "navigate_to_page",
    description: "Navigate the admin dashboard to a different page by its path.",
    parametersSchema: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Route path starting with /dashboard." },
      },
      required: ["path"],
    },
  },
  {
    name: "fill_form_field",
    description: "Fill a form field on the current page using a selector from the snapshot.",
    parametersSchema: {
      type: "OBJECT",
      properties: {
        selector: { type: "STRING" },
        value: { type: "STRING" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "click_element",
    description: "Click a button or interactive element on the current page.",
    parametersSchema: {
      type: "OBJECT",
      properties: {
        selector: { type: "STRING" },
      },
      required: ["selector"],
    },
  },
]

// ---------- DOM helpers ----------

function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  setter?.call(el, value)
  // Reset React's internal _valueTracker so onChange fires
  const tracker = (el as any)._valueTracker
  if (tracker) tracker.setValue("")
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

function labelForElement(el: HTMLElement): string {
  const id = el.getAttribute("id")
  if (id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (labelEl?.textContent) return labelEl.textContent.trim()
  }
  let parent: HTMLElement | null = el.parentElement
  while (parent) {
    if (parent.tagName === "LABEL" && parent.textContent) {
      return parent.textContent.trim()
    }
    const sibling = parent.querySelector("label")
    if (sibling?.textContent) return sibling.textContent.trim()
    parent = parent.parentElement
    if (parent && parent.children.length > 5) break
  }
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("name") ||
    ""
  )
}

let stamper = 0
function ensureStamp(el: HTMLElement, prefix: string): string {
  const attr = `data-chatbot-${prefix}`
  let v = el.getAttribute(attr)
  if (!v) {
    v = `${prefix}-${++stamper}`
    el.setAttribute(attr, v)
  }
  return `[${attr}="${v}"]`
}

function getFormFields(): FormFieldSnapshot[] {
  if (typeof document === "undefined") return []
  const out: FormFieldSnapshot[] = []

  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input:not([type=hidden]), textarea"
    )
  )
  for (const el of inputs) {
    if (!el.offsetParent && el.type !== "hidden") continue
    const id = el.getAttribute("id")
    const name = el.getAttribute("name")
    const selector = id
      ? `#${CSS.escape(id)}`
      : name
        ? `[name="${name}"]`
        : ensureStamp(el, "input")
    out.push({
      selector,
      label: labelForElement(el),
      type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
      currentValue: el.value,
    })
  }

  const selects = Array.from(
    document.querySelectorAll<HTMLElement>('button[role="combobox"]')
  )
  for (const el of selects) {
    if (!el.offsetParent) continue
    const selector = ensureStamp(el, "select")
    out.push({
      selector,
      label: labelForElement(el),
      type: "select",
      currentValue: el.textContent?.trim() || "",
    })
  }

  const checks = Array.from(
    document.querySelectorAll<HTMLElement>('button[role="checkbox"]')
  )
  for (const el of checks) {
    if (!el.offsetParent) continue
    const selector = ensureStamp(el, "checkbox")
    out.push({
      selector,
      label: labelForElement(el),
      type: "checkbox",
      currentValue: el.getAttribute("data-state") || "",
    })
  }

  const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radiogroup"]'))
  for (const group of radios) {
    if (!group.offsetParent) continue
    const selector = ensureStamp(group, "radio")
    const items = Array.from(group.querySelectorAll<HTMLElement>('button[role="radio"]'))
    out.push({
      selector,
      label: labelForElement(group),
      type: "radio",
      currentValue:
        items.find((i) => i.getAttribute("data-state") === "checked")?.textContent?.trim() ||
        "",
      options: items.map((i) => i.textContent?.trim() || ""),
    })
  }

  // Buttons (submit / explicit)
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button[type=submit], button[data-action]")
  )
  for (const el of buttons) {
    if (!el.offsetParent) continue
    const selector = el.getAttribute("data-action")
      ? `button[data-action="${el.getAttribute("data-action")}"]`
      : ensureStamp(el, "btn")
    out.push({
      selector,
      label: el.textContent?.trim() || "",
      type: "button",
      currentValue: "",
    })
  }

  return out
}

function getPageContent(): string {
  if (typeof document === "undefined") return ""
  const lines: string[] = []
  document
    .querySelectorAll<HTMLElement>("h1, h2, h3")
    .forEach((el) => lines.push(`${el.tagName}: ${el.textContent?.trim() || ""}`))
  document
    .querySelectorAll<HTMLElement>("[data-stat-card], [data-card-title]")
    .forEach((el) => {
      const t = el.textContent?.trim()
      if (t) lines.push(`STAT: ${t}`)
    })
  const rows = Array.from(document.querySelectorAll<HTMLElement>("table tr"))
  rows.slice(0, 30).forEach((tr, i) => {
    const cells = Array.from(tr.querySelectorAll<HTMLElement>("th, td"))
      .map((c) => c.textContent?.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .join(" | ")
    if (cells) lines.push(`[ROW ${i}] ${cells}`)
  })
  document
    .querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper], [role="dialog"]')
    .forEach((el) => {
      const t = el.textContent?.trim()
      if (t) lines.push(`MODAL: ${t.slice(0, 800)}`)
    })
  return lines.join("\n").slice(0, 12000)
}

function formFieldsForPrompt(fields: FormFieldSnapshot[]): string {
  return fields
    .map((f) => {
      const opts = f.options?.length ? ` options=[${f.options.join(", ")}]` : ""
      return `selector="${f.selector}" type=${f.type} label="${f.label}" current="${f.currentValue}"${opts}`
    })
    .join("\n")
}

// ---------- Action executor ----------

async function executeAction(
  action: ChatAction,
  router: ReturnType<typeof useRouter>
): Promise<{ ok: boolean; message: string }> {
  if (action.type === "navigate") {
    if (!action.path) return { ok: false, message: "missing path" }
    router.push(action.path)
    return { ok: true, message: `navigated to ${action.path}` }
  }
  if (action.type === "click") {
    const el = action.selector ? document.querySelector<HTMLElement>(action.selector) : null
    if (!el) return { ok: false, message: `no element matched ${action.selector}` }
    el.click()
    return { ok: true, message: `clicked ${action.selector}` }
  }
  if (action.type === "fill") {
    const sel = action.selector || ""
    const value = action.value ?? ""
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return { ok: false, message: `no element matched ${sel}` }

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setReactInputValue(el, value)
      return { ok: true, message: `filled ${sel}` }
    }
    if (el.getAttribute("role") === "combobox") {
      el.click()
      await new Promise((r) => setTimeout(r, 200))
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-radix-select-viewport] [role="option"], [role="listbox"] [role="option"]'
        )
      )
      const target = items.find(
        (i) => i.textContent?.trim().toLowerCase() === value.toLowerCase()
      )
      if (target) {
        target.click()
        return { ok: true, message: `selected ${value}` }
      }
      // close
      el.click()
      return { ok: false, message: `option "${value}" not found in ${sel}` }
    }
    if (el.getAttribute("role") === "checkbox") {
      const desired = ["true", "1", "yes", "on", "checked"].includes(value.toLowerCase())
      const isChecked = el.getAttribute("data-state") === "checked"
      if (desired !== isChecked) el.click()
      return { ok: true, message: `checkbox ${desired ? "checked" : "unchecked"}` }
    }
    if (el.getAttribute("role") === "radiogroup") {
      const items = Array.from(el.querySelectorAll<HTMLElement>('button[role="radio"]'))
      const target = items.find(
        (i) =>
          i.getAttribute("value")?.toLowerCase() === value.toLowerCase() ||
          i.textContent?.trim().toLowerCase() === value.toLowerCase()
      )
      if (target) {
        target.click()
        return { ok: true, message: `radio ${value} selected` }
      }
      return { ok: false, message: `radio option "${value}" not found` }
    }
    return { ok: false, message: `unsupported element type for ${sel}` }
  }
  if (action.type === "reply") {
    return { ok: true, message: action.text || "" }
  }
  return { ok: false, message: `unknown action type: ${action.type}` }
}

// ---------- Component ----------

export default function ChatWidget() {
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your CRM assistant. I can navigate the dashboard, fill forms, and click buttons. Try “go to orders” or “fill batch number BN-2026-001”.",
    },
  ])
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Live (voice) state
  const liveOnToolCall = useCallback(
    async (name: string, args: Record<string, any>) => {
      let action: ChatAction | null = null
      if (name === "navigate_to_page") action = { type: "navigate", path: args.path }
      else if (name === "fill_form_field")
        action = { type: "fill", selector: args.selector, value: args.value }
      else if (name === "click_element") action = { type: "click", selector: args.selector }
      if (!action) return { error: `unknown tool: ${name}` }
      const result = await executeAction(action, router)
      return result
    },
    [router]
  )

  const live = useGeminiLive({
    systemInstruction: SYSTEM_PROMPT_LIVE,
    tools: LIVE_TOOLS,
    onToolCall: liveOnToolCall,
  })

  // Toggle with Ctrl+. (or Cmd+.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, messages])

  const sendText = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim()
      if (!text || busy) return
      const userMsg: ChatMsg = { role: "user", content: text }
      const next: ChatMsg[] = [...messages, userMsg]
      setMessages(next)
      setInput("")
      setBusy(true)
      try {
        const fields = getFormFields()
        const res = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            currentPath: pathname,
            pageContent: getPageContent(),
            formFields: formFieldsForPrompt(fields),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Request failed")
        const summary: string = data.summary || ""
        const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : []

        const replyTexts: string[] = []
        if (summary) replyTexts.push(summary)

        for (const action of actions) {
          if (action.type === "reply" && action.text) {
            replyTexts.push(action.text)
            continue
          }
          const r = await executeAction(action, router)
          if (!r.ok) replyTexts.push(`(failed: ${r.message})`)
        }

        if (replyTexts.length) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: replyTexts.join("\n") },
          ])
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err?.message || "request failed"}` },
        ])
      } finally {
        setBusy(false)
      }
    },
    [input, messages, busy, pathname, router]
  )

  const liveLabel = useMemo(() => {
    if (live.status === "connecting") return "Connecting…"
    if (live.status === "live") return "Listening"
    if (live.status === "speaking") return "Speaking"
    if (live.status === "error") return "Error"
    return "Voice"
  }, [live.status])

  const isLiveOn = live.status !== "idle" && live.status !== "error"

  return (
    <>
      {!open && (
        <button
          aria-label="Open AI assistant"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 flex items-center justify-center"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-2rem)] rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              CRM Assistant
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={isLiveOn ? "default" : "ghost"}
                onClick={() => (isLiveOn ? live.stop() : live.start())}
                className="h-7 px-2 text-xs"
                title="Toggle voice (duplex)"
              >
                {live.status === "connecting" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : live.status === "speaking" ? (
                  <Volume2 className="h-3.5 w-3.5 mr-1" />
                ) : isLiveOn ? (
                  <Mic className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <MicOff className="h-3.5 w-3.5 mr-1" />
                )}
                {liveLabel}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-7 w-7 p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm whitespace-pre-wrap rounded-lg px-3 py-2 max-w-[85%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground mr-auto"
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                thinking…
              </div>
            )}
            {live.transcript.length > 0 && (
              <div className="border-t pt-2 mt-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Voice transcript</p>
                {live.transcript.map((t) => (
                  <p key={t.id} className={t.role === "user" ? "" : "text-foreground"}>
                    <span className="font-medium">
                      {t.role === "user" ? "you: " : "ai: "}
                    </span>
                    {t.text}
                    {t.partial && "…"}
                  </p>
                ))}
              </div>
            )}
            {live.error && (
              <p className="text-xs text-red-600">Voice error: {live.error}</p>
            )}
          </div>

          <form
            className="border-t p-2 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              sendText()
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendText()
                }
              }}
              placeholder="Ask or instruct… (Enter to send)"
              rows={2}
              className="resize-none text-sm"
            />
            <Button type="submit" size="sm" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
