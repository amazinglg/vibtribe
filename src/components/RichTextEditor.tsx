import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon,
  Image as ImageIcon, Undo2, Redo2, Minus,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777']

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
      Image.configure({ inline: false, HTMLAttributes: { style: 'max-width:100%;height:auto;border-radius:8px;' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap-content prose prose-invert max-w-none focus:outline-none min-h-[260px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sync external value changes (e.g. loading a draft).
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  if (!editor) return null

  const Btn = ({ active, onClick, title, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition ${
        active ? 'bg-primary/20 text-primary' : ''
      }`}
    >
      {children}
    </button>
  )

  const addLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('Image URL (use the banner uploader for hosted images)')
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div className="border border-border rounded-xl bg-input/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40">
        <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></Btn>
        <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></Btn>
        <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></Btn>
        <Btn title="Strike" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn title="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={14} /></Btn>
        <Btn title="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></Btn>
        <Btn title="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></Btn>
        <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></Btn>
        <Btn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></Btn>
        <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={14} /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={14} /></Btn>
        <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={14} /></Btn>
        <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={14} /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn title="Add link" active={editor.isActive('link')} onClick={addLink}><LinkIcon size={14} /></Btn>
        <Btn title="Insert image" onClick={addImage}><ImageIcon size={14} /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex items-center gap-0.5">
          {COLORS.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => editor.chain().focus().setColor(c).run()}
              title={`Text color ${c}`}
              className="w-4 h-4 rounded-full border border-border/50 hover:scale-110 transition"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetColor().run()}
            title="Reset color"
            className="text-[10px] text-muted-foreground px-1 hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={14} /></Btn>
          <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={14} /></Btn>
        </div>
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-content { color: hsl(var(--foreground)); font-size: 14px; line-height: 1.6; }
        .tiptap-content h1 { font-size: 24px; font-weight: 700; margin: 16px 0 8px; }
        .tiptap-content h2 { font-size: 20px; font-weight: 700; margin: 14px 0 6px; }
        .tiptap-content h3 { font-size: 17px; font-weight: 600; margin: 12px 0 6px; }
        .tiptap-content p { margin: 8px 0; }
        .tiptap-content a { color: hsl(var(--primary)); text-decoration: underline; }
        .tiptap-content ul, .tiptap-content ol { padding-left: 22px; margin: 8px 0; }
        .tiptap-content blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 12px; color: hsl(var(--muted-foreground)); margin: 12px 0; font-style: italic; }
        .tiptap-content hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 16px 0; }
        .tiptap-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
      `}</style>
    </div>
  )
}