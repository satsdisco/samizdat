import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import './Editor.css'

interface EditorProps {
  onContentChange?: (content: string) => void
}

export function Editor({ onContentChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Typography,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'samizdat-editor',
      },
    },
  })

  return (
    <div className="editor-wrapper">
      <EditorContent editor={editor} />
    </div>
  )
}
