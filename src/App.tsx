import { useState, useRef, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TitleBar } from './components/TitleBar'
import { ArticleReader } from './components/ArticleReader'
import { Editor, type EditorRef } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { PublishModal } from './components/PublishModal'
import { Toast } from './components/Toast'
import { Preview } from './components/Preview'
import { LoginScreen } from './components/LoginScreen'
import { Landing } from './components/Landing'
import { useNostr } from './hooks/useNostr'
import type { Article } from './types/nostr'
import './styles/theme.css'

function App() {
  const [nostr, actions] = useNostr()
  const editorRef = useRef<EditorRef>(null)
  const [showLogin, setShowLogin] = useState(false)

  // Editor state
  const [title, setTitle] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [currentHtml, setCurrentHtml] = useState('')
  const [currentSlug, setCurrentSlug] = useState<string | undefined>()
  const [currentPublishedAt, setCurrentPublishedAt] = useState<number | undefined>()
  const [bannerImage, setBannerImage] = useState('')

  // UI state
  const [showSidebar, setShowSidebar] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleContentChange = useCallback((html: string) => {
    setCurrentHtml(html)
    const text = html.replace(/<[^>]*>/g, ' ').trim()
    const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0
    setWordCount(words)
  }, [])

  // Auto-save title to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('samizdat_draft_title')
    if (saved) setTitle(saved)
  }, [])

  useEffect(() => {
    if (title) localStorage.setItem('samizdat_draft_title', title)
  }, [title])

  // Load articles when connected
  useEffect(() => {
    if (nostr.isConnected && nostr.articles.length === 0) {
      actions.loadArticles()
    }
  }, [nostr.isConnected])

  // Publish flow
  const handlePublish = useCallback((options: { summary: string; tags: string[]; image: string; zapGate?: { amount: number; previewEnd: number } }) => {
    actions.publish(title, currentHtml, {
      summary: options.summary,
      tags: options.tags,
      image: options.image || bannerImage,
      slug: currentSlug,
      isDraft: false,
      existingPublishedAt: currentPublishedAt,
      zapGate: options.zapGate,
    })
  }, [title, currentHtml, currentSlug, currentPublishedAt, bannerImage, actions])

  // Save draft
  const handleSaveDraft = useCallback(() => {
    actions.publish(title, currentHtml, {
      slug: currentSlug,
      isDraft: true,
    })
  }, [title, currentHtml, currentSlug, actions])

  // Load an article into the editor
  const handleLoadArticle = useCallback((article: Article) => {
    setTitle(article.title)
    setCurrentSlug(article.slug)
    setCurrentPublishedAt(article.publishedAt)
    setBannerImage(article.image || '')
    editorRef.current?.loadMarkdown(article.content)
    setShowSidebar(false)
  }, [])

  // New article
  const handleNewArticle = useCallback(() => {
    setTitle('')
    setCurrentSlug(undefined)
    setCurrentPublishedAt(undefined)
    setBannerImage('')
    editorRef.current?.clear()
    setShowSidebar(false)
    localStorage.removeItem('samizdat_draft_title')
  }, [])

  // Dismiss publish result
  useEffect(() => {
    if (nostr.publishResult?.success) {
      setShowPublishModal(false)
    }
  }, [nostr.publishResult])

  // Editor view (landing/login/editor based on auth state)
  const editorView = () => {
    if (!nostr.pubkey) {
      if (showLogin) {
        return (
          <LoginScreen
            onExtensionLogin={actions.loginWithExtension}
            onBunkerLogin={actions.loginWithBunker}
            onNsecLogin={actions.loginWithNsec}
            onQrLogin={actions.initiateQrLogin}
            isLoggingIn={nostr.isLoggingIn}
            loginError={nostr.loginError}
            hasExtension={typeof window !== 'undefined' && !!window.nostr}
          />
        )
      }
      return <Landing onGetStarted={() => setShowLogin(true)} />
    }

    return (
      <div className="app">
        <TitleBar
        wordCount={wordCount}
        onPublish={() => setShowPublishModal(true)}
        onSaveDraft={handleSaveDraft}
        onPreview={() => setShowPreview(true)}
        isConnected={nostr.isConnected}
        isPublishing={nostr.isPublishing}
        pubkey={nostr.pubkey}
        npub={nostr.npub}
        npubShort={nostr.npubShort}
        profile={nostr.profile}
        onLogin={actions.loginWithExtension}
        onLogout={actions.logout}
        isLoggingIn={nostr.isLoggingIn}
        relayCount={nostr.relays.length}
        relays={nostr.relays}
        onRelayToggle={actions.toggleRelay}
        onRelayAdd={actions.addRelay}
        onRelayRemove={actions.removeRelay}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />

      <Editor
        ref={editorRef}
        title={title}
        onTitleChange={setTitle}
        onContentChange={handleContentChange}
        bannerImage={bannerImage}
        onBannerChange={setBannerImage}
        signEvent={actions.signEvent}
      />

      <Sidebar
        articles={nostr.articles}
        drafts={nostr.drafts}
        isLoading={nostr.isLoadingArticles}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onLoadArticle={handleLoadArticle}
        onDeleteArticle={actions.deleteArticle}
        onNewArticle={handleNewArticle}
        onRefresh={actions.loadArticles}
      />

      {showPreview && (
        <Preview
          title={title}
          bannerImage={bannerImage}
          html={currentHtml}
          profile={nostr.profile}
          npubShort={nostr.npubShort}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showPublishModal && (
        <PublishModal
          title={title}
          onPublish={handlePublish}
          onClose={() => setShowPublishModal(false)}
          isPublishing={nostr.isPublishing}
          paragraphCount={currentHtml.split(/<\/p>/i).length - 1 || 1}
        />
      )}

      {nostr.publishResult && (
        <Toast
          message={nostr.publishResult.message}
          type={nostr.publishResult.success ? 'success' : 'error'}
          onClose={actions.clearPublishResult}
        />
      )}
    </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/a/:naddr" element={<ArticleReader />} />
        <Route path="*" element={editorView()} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
