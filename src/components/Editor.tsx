import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useImperativeHandle, forwardRef, useCallback, useState } from 'react'
import { markdownToHtml } from '../lib/markdown'
import { uploadImage, type SignEventFn } from '../lib/upload'
import './Editor.css'

interface EditorProps {
  onContentChange?: (html: string) => void
  onTitleChange?: (title: string) => void
  title: string
  bannerImage?: string
  onBannerChange?: (url: string) => void
  signEvent?: SignEventFn
}

export interface EditorRef {
  getHTML: () => string
  setContent: (html: string) => void
  clear: () => void
  loadMarkdown: (markdown: string) => void
}

export const Editor = forwardRef<EditorRef, EditorProps>(({
  onContentChange,
  onTitleChange,
  title,
  bannerImage,
  onBannerChange,
  signEvent,
}, ref) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [isBannerUploading, setIsBannerUploading] = useState(false)

  const insertImage = useCallback(async (file: File) => {
    if (!editor) return
    if (!file.type.startsWith('image/')) return

    setIsUploading(true)
    setUploadProgress('Uploading image…')

    try {
      const result = await uploadImage(file, signEvent)
      editor.chain().focus().setImage({ src: result.url }).run()
      setUploadProgress('')
    } catch (e: any) {
      setUploadProgress(`Upload failed: ${e.message}`)
      setTimeout(() => setUploadProgress(''), 3000)
    } finally {
      setIsUploading(false)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your samizdat...',
      }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'article-image',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'samizdat-editor',
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files
        if (files && files.length > 0) {
          const file = files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            insertImage(file)
            return true
          }
        }
        return false
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items
        if (items) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const blob = item.getAsFile()
              if (blob) insertImage(blob)
              return true
            }
          }
        }
        return false
      },
    },
  })

  // Re-bind insertImage with the actual editor
  const handleInsertImageClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) insertImage(file)
    }
    input.click()
  }, [insertImage])

  const handleBannerUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setIsBannerUploading(true)
      try {
        const result = await uploadImage(file, signEvent)
        onBannerChange?.(result.url)
      } catch (e: any) {
        setUploadProgress(`Banner upload failed: ${e.message}`)
        setTimeout(() => setUploadProgress(''), 3000)
      } finally {
        setIsBannerUploading(false)
      }
    }
    input.click()
  }, [onBannerChange])

  const handleBannerRemove = useCallback(() => {
    onBannerChange?.('')
  }, [onBannerChange])

  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() || '',
    setContent: (html: string) => editor?.commands.setContent(html),
    clear: () => editor?.commands.clearContent(),
    loadMarkdown: (markdown: string) => {
      const html = markdownToHtml(markdown)
      editor?.commands.setContent(html)
    },
  }), [editor])

  return (
    <div className="editor-wrapper">
      {/* Banner image */}
      <div
        className={`banner-area ${bannerImage ? 'has-image' : ''} ${isBannerUploading ? 'uploading' : ''}`}
        onClick={!bannerImage ? handleBannerUpload : undefined}
      >
        {bannerImage ? (
          <>
            <img src={bannerImage} alt="Article banner" className="banner-img" />
            <div className="banner-actions">
              <button className="banner-action-btn" onClick={handleBannerUpload}>Change</button>
              <button className="banner-action-btn danger" onClick={handleBannerRemove}>Remove</button>
            </div>
          </>
        ) : (
          <div className="banner-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span>{isBannerUploading ? 'Uploading…' : 'Add a cover image'}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <input
        className="title-input"
        type="text"
        value={title}
        onChange={e => onTitleChange?.(e.target.value)}
        placeholder="Title"
      />

      {/* Editor toolbar (minimal) */}
      <div className="editor-toolbar">
        <button
          className="toolbar-btn"
          onClick={handleInsertImageClick}
          disabled={isUploading}
          title="Insert image"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>
        {uploadProgress && (
          <span className="upload-status">{uploadProgress}</span>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
})
