"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Minus,
  Eraser,
} from "lucide-react"

const BUCKET = "blog-images"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editorClassName?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  className,
  editorClassName,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none min-h-[400px] px-4 py-3",
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be smaller than 5 MB")
        return
      }
      const ext = file.name.split(".").pop() || "png"
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const path = `uploads/${filename}`

      const uploadPromise = (async () => {
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false })
        if (upErr) throw upErr
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        return data.publicUrl
      })()

      toast.promise(uploadPromise, {
        loading: "Uploading image…",
        success: (url) => {
          editor.chain().focus().setImage({ src: url }).run()
          return "Image inserted"
        },
        error: (err) => err?.message || "Upload failed",
      })
    },
    [editor]
  )

  const onPickImage = () => fileInputRef.current?.click()

  const addLink = () => {
    if (!editor) return
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL", previous || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  if (!editor) {
    return (
      <div className="rounded-md border min-h-[400px] animate-pulse bg-muted/20" />
    )
  }

  return (
    <div className={cn("tiptap-editor rounded-md border bg-background", className)}>
      <Toolbar
        editor={editor}
        onPickImage={onPickImage}
        onAddLink={addLink}
      />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadImage(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

interface ToolbarProps {
  editor: Editor
  onPickImage: () => void
  onAddLink: () => void
}

function Toolbar({ editor, onPickImage, onAddLink }: ToolbarProps) {
  const btn = (active: boolean) =>
    cn(
      "h-8 w-8 p-0",
      active && "bg-accent text-accent-foreground"
    )

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1 sticky top-0 bg-background z-10">
      <ToolBtn
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("underline"))}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        className={btn(editor.isActive("heading", { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("code"))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline Code"
      >
        <Code className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive("codeBlock"))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        <Code2 className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        className={btn(editor.isActive({ textAlign: "left" }))}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive({ textAlign: "center" }))}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive({ textAlign: "right" }))}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(editor.isActive({ textAlign: "justify" }))}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        title="Justify"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        className={btn(editor.isActive("link"))}
        onClick={onAddLink}
        title="Link"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(false)}
        onClick={onPickImage}
        title="Upload Image"
      >
        <ImageIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn
        className={btn(false)}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        title="Clear Formatting"
      >
        <Eraser className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(false)}
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
        disabled={!editor.can().undo()}
      >
        <Undo className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        className={btn(false)}
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
        disabled={!editor.can().redo()}
      >
        <Redo className="h-4 w-4" />
      </ToolBtn>
    </div>
  )
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-border" aria-hidden />
}

function ToolBtn({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={className}
      {...rest}
    >
      {children}
    </Button>
  )
}
