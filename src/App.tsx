import { useState, useRef, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TitleBar } from './components/TitleBar'
import { ArticleReader } from './components/ArticleReader'
import { Press } from './components/Press'
import { Editor, type EditorRef } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { PublishModal } from './components/PublishModal'
import { Toast } from './components/Toast'
import { Preview } from './components/Preview'
import { LoginScreen } from './components/LoginScreen'
import { Landing } from './components/Landing'
import { AuthCallback } from './components/AuthCallback'
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
    // Auto-save to localStorage
    localStorage.setItem('samizdat_draft_content', html)
  }, [])

  // Handle nstart #nostr-login=... redirect (fallback for modal)
  useEffect(() => {
    if (window.location.hash && window.location.hash.startsWith('#nostr-login=')) {
      const cred = decodeURIComponent(window.location.hash.replace('#nostr-login=', ''))
      // Remove credentials from URL immediately (security)
      history.replaceState(null, '', window.location.href.split('#')[0])
      if (cred.startsWith('bunker://')) {
        actions.loginWithBunker(cred)
      } else if (cred.startsWith('nsec1')) {
        actions.loginWithNsec(cred)
      }
    }
  }, [])

  // Restore saved draft from localStorage
  useEffect(() => {
    const savedTitle = localStorage.getItem('samizdat_draft_title')
    if (savedTitle) setTitle(savedTitle)
    const savedContent = localStorage.getItem('samizdat_draft_content')
    const savedBanner = localStorage.getItem('samizdat_draft_banner')
    if (savedContent) {
      // Small delay to let editor mount first
      setTimeout(() => editorRef.current?.setContent(savedContent), 100)
    }
    if (savedBanner) setBannerImage(savedBanner)
  }, [])

  useEffect(() => {
    if (title) localStorage.setItem('samizdat_draft_title', title)
  }, [title])

  useEffect(() => {
    if (bannerImage) localStorage.setItem('samizdat_draft_banner', bannerImage)
    else localStorage.removeItem('samizdat_draft_banner')
  }, [bannerImage])

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

  // Save draft — always saves to localStorage, attempts relay publish if possible
  const handleSaveDraft = useCallback(() => {
    // Always save locally first — this never fails
    localStorage.setItem('samizdat_draft_title', title)
    localStorage.setItem('samizdat_draft_content', currentHtml)
    if (bannerImage) localStorage.setItem('samizdat_draft_banner', bannerImage)

    // Try to publish to relays too (may fail if session expired)
    actions.publish(title, currentHtml, {
      slug: currentSlug,
      isDraft: true,
    }).catch?.(() => {
      // Relay publish failed but local save succeeded — that's ok
    })
  }, [title, currentHtml, currentSlug, bannerImage, actions])

  // Load an article into the editor
  const handleLoadArticle = useCallback((article: Article) => {
    // Check if there's unsaved work and warn
    const currentText = currentHtml.replace(/<[^>]*>/g, ' ').trim()
    if (currentText.length > 50 && title) {
      const confirmed = window.confirm(`You have unsaved changes in "${title}". Load "${article.title}" instead?`)
      if (!confirmed) return
    }
    setTitle(article.title)
    setCurrentSlug(article.slug)
    setCurrentPublishedAt(article.publishedAt)
    setBannerImage(article.image || '')
    editorRef.current?.loadMarkdown(article.content)
    setShowSidebar(false)
  }, [currentHtml, title])

  // New article
  const handleNewArticle = useCallback(() => {
    setTitle('')
    setCurrentSlug(undefined)
    setCurrentPublishedAt(undefined)
    setBannerImage('')
    editorRef.current?.clear()
    setShowSidebar(false)
    localStorage.removeItem('samizdat_draft_title')
    localStorage.removeItem('samizdat_draft_content')
    localStorage.removeItem('samizdat_draft_banner')
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
          naddr={nostr.publishResult.naddr}
        />
      )}
    </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/a/:naddr" element={<ArticleReader />} />
        <Route path="/read" element={<Press />} />
        <Route path="*" element={editorView()} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
