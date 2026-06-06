import React, { useState, useRef, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useDeepLinks } from './hooks/useDeepLinks'
import { useBackButton } from './hooks/useBackButton'
import { Capacitor } from '@capacitor/core'
import { getPublicKey as getAndroidSignerPubkey, androidSignerAvailable } from './lib/androidSigner'
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
import { Settings } from './components/Settings'
import { NativeWriteBar } from './components/NativeWriteBar'
import { useNostr } from './hooks/useNostr'
import type { Article } from './types/nostr'
import './styles/theme.css'

const DRAFT_TITLE_KEY = 'samizdat_draft_title'
const DRAFT_CONTENT_KEY = 'samizdat_draft_content'
const DRAFT_BANNER_KEY = 'samizdat_draft_banner'

function clearLocalDraft() {
  localStorage.removeItem(DRAFT_TITLE_KEY)
  localStorage.removeItem(DRAFT_CONTENT_KEY)
  localStorage.removeItem(DRAFT_BANNER_KEY)
}

function hasMeaningfulHtml(html: string) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  return text.length > 0 || /<img[\s>]/i.test(html)
}

function App() {
  const [nostr, actions] = useNostr()
  const editorRef = useRef<EditorRef>(null)
  const activeArticleSlugRef = useRef<string | undefined>(undefined)
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
    // Auto-save only truly new local drafts. Loaded articles/drafts have their own relay identity.
    if (!activeArticleSlugRef.current && hasMeaningfulHtml(html)) {
      localStorage.setItem(DRAFT_CONTENT_KEY, html)
    } else if (!activeArticleSlugRef.current) {
      localStorage.removeItem(DRAFT_CONTENT_KEY)
    }
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
    const savedTitle = localStorage.getItem(DRAFT_TITLE_KEY)
    if (savedTitle) setTitle(savedTitle)
    const savedContent = localStorage.getItem(DRAFT_CONTENT_KEY)
    const savedBanner = localStorage.getItem(DRAFT_BANNER_KEY)
    if (savedContent) {
      // Small delay to let editor mount first
      setTimeout(() => editorRef.current?.setContent(savedContent), 100)
    }
    if (savedBanner) setBannerImage(savedBanner)
  }, [])

  useEffect(() => {
    if (currentSlug) return
    if (title) localStorage.setItem(DRAFT_TITLE_KEY, title)
    else localStorage.removeItem(DRAFT_TITLE_KEY)
  }, [title, currentSlug])

  useEffect(() => {
    if (currentSlug) return
    if (bannerImage) localStorage.setItem(DRAFT_BANNER_KEY, bannerImage)
    else localStorage.removeItem(DRAFT_BANNER_KEY)
  }, [bannerImage, currentSlug])

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

  // Save draft — localStorage is only for new unslugged drafts; relay drafts keep slugged article state.
  const handleSaveDraft = useCallback(() => {
    if (!currentSlug) {
      if (title) localStorage.setItem(DRAFT_TITLE_KEY, title)
      else localStorage.removeItem(DRAFT_TITLE_KEY)
      if (hasMeaningfulHtml(currentHtml)) localStorage.setItem(DRAFT_CONTENT_KEY, currentHtml)
      else localStorage.removeItem(DRAFT_CONTENT_KEY)
      if (bannerImage) localStorage.setItem(DRAFT_BANNER_KEY, bannerImage)
      else localStorage.removeItem(DRAFT_BANNER_KEY)
    }

    // Try to publish to relays too (may fail if session expired)
    actions.publish(title, currentHtml, {
      slug: currentSlug,
      isDraft: true,
      image: bannerImage,
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
    activeArticleSlugRef.current = article.slug
    setTitle(article.title)
    setCurrentSlug(article.slug)
    setCurrentPublishedAt(article.publishedAt)
    setBannerImage(article.image || '')
    clearLocalDraft()
    editorRef.current?.loadMarkdown(article.content)
    setShowSidebar(false)
  }, [currentHtml, title])

  // New article
  const handleNewArticle = useCallback(() => {
    activeArticleSlugRef.current = undefined
    setTitle('')
    setCurrentSlug(undefined)
    setCurrentPublishedAt(undefined)
    setBannerImage('')
    setCurrentHtml('')
    setWordCount(0)
    editorRef.current?.clear()
    setShowSidebar(false)
    clearLocalDraft()
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
            onAndroidSignerLogin={androidSignerAvailable() ? async () => {
              try {
                const { pubkey } = await getAndroidSignerPubkey()
                // Store pubkey + auth method — signer will be used for signing events later
                localStorage.setItem('samizdat_pubkey', pubkey)
                localStorage.setItem('samizdat_auth_method', 'android-signer')
                // Force reload to pick up new auth state
                window.location.href = '/write'
              } catch (e: any) {
                console.error('Android signer login failed:', e)
              }
            } : undefined}
            onQrLogin={actions.initiateQrLogin}
            isLoggingIn={nostr.isLoggingIn}
            loginError={nostr.loginError}
          />
        )
      }
      return <Landing onGetStarted={() => setShowLogin(true)} />
    }

    const isNativeAndroid = Capacitor.isNativePlatform()

    return (
      <div className={`app ${isNativeAndroid ? 'native-write' : ''}`}>
        {/* Desktop: full TitleBar. Native: slim header with just logo + avatar */}
        {isNativeAndroid ? (
          <div className="native-top-bar">
            <span className="native-top-logo">samizdat</span>
            <button
              className="native-top-avatar"
              onPointerUp={() => window.location.href = '/settings'}
            >
              {nostr.profile?.picture ? (
                <img src={nostr.profile.picture} alt="" />
              ) : (
                <span>{(nostr.profile?.name || '?')[0]?.toUpperCase()}</span>
              )}
            </button>
          </div>
        ) : (
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
        )}

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

      {/* Native Android: bottom write bar */}
      {isNativeAndroid && (
        <NativeWriteBar
          wordCount={wordCount}
          isConnected={nostr.isConnected}
          isPublishing={nostr.isPublishing}
          relays={nostr.relays}
          onPublish={() => setShowPublishModal(true)}
          onSaveDraft={handleSaveDraft}
          onPreview={() => setShowPreview(true)}
          onRelayToggle={actions.toggleRelay}
          onRelayAdd={actions.addRelay}
          onRelayRemove={actions.removeRelay}
          onBack={() => window.history.back()}
        />
      )}

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
      <AppRoutes editorView={editorView} nostr={nostr} actions={actions} />
    </BrowserRouter>
  )
}

// Separate component so useDeepLinks/useBackButton (which need useNavigate) are inside BrowserRouter
function AppRoutes({ editorView, nostr, actions }: { editorView: () => React.ReactNode; nostr: any; actions: any }) {
  useDeepLinks()
  useBackButton()

  // On native mobile, the app opens to the reader (Press) by default
  // On web, it opens to the landing/editor view
  const isNative = Capacitor.isNativePlatform()

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/a/:naddr" element={
        <ArticleReader
          currentUserPubkey={nostr.pubkey}
          onDeleteArticle={actions.deleteArticle}
        />
      } />
      <Route path="/read" element={<Press />} />
      <Route path="/settings" element={
        <Settings
          profile={nostr.profile}
          pubkey={nostr.pubkey}
          authMethod={nostr.authMethod}
          onLogout={actions.logout}
        />
      } />
      <Route path="/write" element={editorView()} />
      {isNative ? (
        <Route path="*" element={<Press />} />
      ) : (
        <Route path="*" element={editorView()} />
      )}
    </Routes>
  )
}

export default App
