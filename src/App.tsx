import { useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { Editor } from './components/Editor'
import './styles/theme.css'

function App() {
  const [wordCount, setWordCount] = useState(0)

  const handleContentChange = (html: string) => {
    const text = html.replace(/<[^>]*>/g, ' ').trim()
    const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0
    setWordCount(words)
  }

  const handlePublish = () => {
    // TODO: NIP-23 publishing
    console.log('Publishing to Nostr...')
  }

  return (
    <div className="app">
      <TitleBar 
        wordCount={wordCount}
        onPublish={handlePublish}
        isConnected={false}
      />
      <Editor onContentChange={handleContentChange} />
    </div>
  )
}

export default App
