"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { GoogleGenAI, Modality, type Session } from "@google/genai"

export type LiveStatus = "idle" | "connecting" | "live" | "speaking" | "closing" | "error"

export interface LiveTool {
  name: string
  description: string
  parametersSchema: any
}

export interface LiveTranscriptItem {
  id: string
  role: "user" | "assistant"
  text: string
  partial: boolean
}

interface UseGeminiLiveOpts {
  systemInstruction: string
  tools: LiveTool[]
  onToolCall: (
    name: string,
    args: Record<string, any>
  ) => Promise<Record<string, any>> | Record<string, any>
  voiceName?: string
  liveModel?: string
}

const DEFAULT_LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ||
  "models/gemini-2.0-flash-exp"

const TARGET_INPUT_RATE = 16000
const TARGET_OUTPUT_RATE = 24000

function float32ToPcm16Base64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let binary = ""
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out = new Float32Array(bytes.length / 2)
  for (let i = 0; i < out.length; i++) {
    const v = view.getInt16(i * 2, true)
    out[i] = v / 0x8000
  }
  return out
}

function downsampleTo16k(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === TARGET_INPUT_RATE) return input
  const ratio = sourceRate / TARGET_INPUT_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const idx = Math.floor(i * ratio)
    out[i] = input[idx]
  }
  return out
}

export function useGeminiLive(opts: UseGeminiLiveOpts) {
  const [status, setStatus] = useState<LiveStatus>("idle")
  const [transcript, setTranscript] = useState<LiveTranscriptItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const sessionRef = useRef<Session | null>(null)
  const aiRef = useRef<GoogleGenAI | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const inputCtxRef = useRef<AudioContext | null>(null)
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const outputCtxRef = useRef<AudioContext | null>(null)
  const playbackQueueRef = useRef<AudioBuffer[]>([])
  const playbackPlayingRef = useRef<boolean>(false)
  const playbackStartTimeRef = useRef<number>(0)
  const isAiSpeakingRef = useRef<boolean>(false)
  const userTurnIdRef = useRef<string>("")
  const aiTurnIdRef = useRef<string>("")

  const cleanup = useCallback(() => {
    try {
      inputProcessorRef.current?.disconnect()
    } catch {}
    inputProcessorRef.current = null

    if (inputCtxRef.current && inputCtxRef.current.state !== "closed") {
      inputCtxRef.current.close().catch(() => {})
    }
    inputCtxRef.current = null

    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null

    if (outputCtxRef.current && outputCtxRef.current.state !== "closed") {
      outputCtxRef.current.close().catch(() => {})
    }
    outputCtxRef.current = null
    playbackQueueRef.current = []
    playbackPlayingRef.current = false

    try {
      sessionRef.current?.close()
    } catch {}
    sessionRef.current = null
    aiRef.current = null
    isAiSpeakingRef.current = false
  }, [])

  const stop = useCallback(() => {
    setStatus("closing")
    cleanup()
    setStatus("idle")
  }, [cleanup])

  const enqueueTranscript = useCallback(
    (role: "user" | "assistant", text: string, partial: boolean) => {
      setTranscript((prev) => {
        const ref = role === "user" ? userTurnIdRef : aiTurnIdRef
        if (!ref.current) ref.current = `${role}-${Date.now()}-${Math.random()}`
        const id = ref.current
        const idx = prev.findIndex((p) => p.id === id)
        const merged = idx >= 0 ? prev[idx].text + text : text
        const item: LiveTranscriptItem = { id, role, text: merged, partial }
        if (idx >= 0) {
          const next = prev.slice()
          next[idx] = item
          return next
        }
        return [...prev, item]
      })
    },
    []
  )

  const finalizeTurn = useCallback((role: "user" | "assistant") => {
    const ref = role === "user" ? userTurnIdRef : aiTurnIdRef
    const id = ref.current
    if (!id) return
    setTranscript((prev) =>
      prev.map((p) => (p.id === id ? { ...p, partial: false } : p))
    )
    ref.current = ""
  }, [])

  const playNextChunk = useCallback(() => {
    const ctx = outputCtxRef.current
    if (!ctx) return
    if (playbackQueueRef.current.length === 0) {
      playbackPlayingRef.current = false
      isAiSpeakingRef.current = false
      setStatus((s) => (s === "speaking" ? "live" : s))
      return
    }
    const buf = playbackQueueRef.current.shift()!
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const startAt = Math.max(ctx.currentTime, playbackStartTimeRef.current)
    src.start(startAt)
    playbackStartTimeRef.current = startAt + buf.duration
    src.onended = () => playNextChunk()
  }, [])

  const queueAudio = useCallback(
    (samples: Float32Array) => {
      if (!outputCtxRef.current) {
        outputCtxRef.current = new AudioContext({ sampleRate: TARGET_OUTPUT_RATE })
        playbackStartTimeRef.current = outputCtxRef.current.currentTime
      }
      const ctx = outputCtxRef.current
      const buf = ctx.createBuffer(1, samples.length, TARGET_OUTPUT_RATE)
      const channel = buf.getChannelData(0)
      channel.set(samples)
      playbackQueueRef.current.push(buf)
      isAiSpeakingRef.current = true
      setStatus("speaking")
      if (!playbackPlayingRef.current) {
        playbackPlayingRef.current = true
        playNextChunk()
      }
    },
    [playNextChunk]
  )

  const start = useCallback(async () => {
    if (status === "live" || status === "connecting" || status === "speaking") return
    setError(null)
    setTranscript([])
    setStatus("connecting")

    try {
      const tokenRes = await fetch("/api/chatbot/live-token", { method: "POST" })
      const tokenJson = await tokenRes.json()
      if (!tokenRes.ok || !tokenJson?.token) {
        throw new Error(tokenJson?.error || "Failed to get live token")
      }

      const ai = new GoogleGenAI({ apiKey: tokenJson.token })
      aiRef.current = ai

      const tools = [
        {
          functionDeclarations: opts.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parametersSchema,
          })),
        },
      ]

      const session = await ai.live.connect({
        model: opts.liveModel || DEFAULT_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: opts.voiceName || "Kore" },
            },
          },
          systemInstruction: opts.systemInstruction,
          tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus("live")
          },
          onmessage: async (msg: any) => {
            // Tool calls
            const toolCalls: any[] =
              msg?.toolCall?.functionCalls ||
              msg?.toolCalls ||
              []
            if (toolCalls && toolCalls.length > 0) {
              const responses = await Promise.all(
                toolCalls.map(async (call: any) => {
                  try {
                    const result = await opts.onToolCall(call.name, call.args || {})
                    return { id: call.id, name: call.name, response: { result } }
                  } catch (err: any) {
                    return {
                      id: call.id,
                      name: call.name,
                      response: { error: err?.message || "tool failed" },
                    }
                  }
                })
              )
              try {
                ;(session as any).sendToolResponse({ functionResponses: responses })
              } catch (err) {
                console.error("sendToolResponse failed:", err)
              }
            }

            // Audio output
            const sc = msg?.serverContent
            if (sc?.interrupted) {
              playbackQueueRef.current = []
              playbackPlayingRef.current = false
              isAiSpeakingRef.current = false
            }
            const parts: any[] = sc?.modelTurn?.parts || []
            for (const p of parts) {
              const inline = p?.inlineData
              if (inline?.data) {
                const samples = base64ToFloat32(inline.data)
                queueAudio(samples)
              }
            }

            // Transcripts
            if (sc?.inputTranscription?.text) {
              enqueueTranscript("user", sc.inputTranscription.text, true)
            }
            if (sc?.outputTranscription?.text) {
              enqueueTranscript("assistant", sc.outputTranscription.text, true)
            }
            if (sc?.turnComplete) {
              finalizeTurn("user")
              finalizeTurn("assistant")
            }
          },
          onerror: (ev: any) => {
            console.error("Live onerror:", ev)
            setError(ev?.message || "Live connection error")
            setStatus("error")
          },
          onclose: () => {
            setStatus("idle")
          },
        },
      })

      sessionRef.current = session

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      micStreamRef.current = stream

      const inputCtx = new AudioContext()
      inputCtxRef.current = inputCtx
      const source = inputCtx.createMediaStreamSource(stream)
      const processor = inputCtx.createScriptProcessor(4096, 1, 1)
      inputProcessorRef.current = processor
      processor.onaudioprocess = (ev) => {
        if (!sessionRef.current) return
        if (isAiSpeakingRef.current) return
        const channel = ev.inputBuffer.getChannelData(0)
        const down = downsampleTo16k(channel, inputCtx.sampleRate)
        const data = float32ToPcm16Base64(down)
        try {
          ;(sessionRef.current as any).sendRealtimeInput({
            audio: { data, mimeType: "audio/pcm;rate=16000" },
          })
        } catch {
          // ignore - session likely closed
        }
      }
      source.connect(processor)
      processor.connect(inputCtx.destination)
    } catch (err: any) {
      console.error("Live start failed:", err)
      setError(err?.message || "Failed to start live session")
      setStatus("error")
      cleanup()
    }
  }, [
    status,
    opts.tools,
    opts.systemInstruction,
    opts.voiceName,
    opts.liveModel,
    opts.onToolCall,
    enqueueTranscript,
    finalizeTurn,
    queueAudio,
    cleanup,
  ])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { status, transcript, error, start, stop }
}
