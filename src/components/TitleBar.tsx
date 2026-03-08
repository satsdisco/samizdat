import './TitleBar.css'

interface TitleBarProps {
  wordCount: number
  onPublish: () => void
  isConnected: boolean
}

export function TitleBar({ wordCount, onPublish, isConnected }: TitleBarProps) {
  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <span className="titlebar-logo">samizdat</span>
      </div>
      <div className="titlebar-center">
        <span className="word-count">{wordCount} words</span>
      </div>
      <div className="titlebar-right">
        <span className={`connection-dot ${isConnected ? 'connected' : ''}`} />
        <button 
          className="publish-btn"
          onClick={onPublish}
          disabled={!isConnected}
        >
          Publish
        </button>
      </div>
    </header>
  )
}
