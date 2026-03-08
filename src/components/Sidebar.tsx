import { useState } from 'react'
import type { Article } from '../types/nostr'
import './Sidebar.css'

interface SidebarProps {
  articles: Article[]
  drafts: Article[]
  isLoading: boolean
  isOpen: boolean
  onClose: () => void
  onLoadArticle: (article: Article) => void
  onDeleteArticle: (article: Article) => void
  onNewArticle: () => void
  onRefresh: () => void
}

export function Sidebar({
  articles,
  drafts,
  isLoading,
  isOpen,
  onClose,
  onLoadArticle,
  onDeleteArticle,
  onNewArticle,
  onRefresh,
}: SidebarProps) {
  const [tab, setTab] = useState<'articles' | 'drafts'>('articles')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const items = tab === 'articles' ? articles : drafts

  const formatDate = (ts?: number) => {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>My Writing</h3>
          <div className="sidebar-actions">
            <button className="sidebar-action" onClick={onRefresh} title="Refresh from relays">
              ↻
            </button>
            <button className="sidebar-action" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${tab === 'articles' ? 'active' : ''}`}
            onClick={() => setTab('articles')}
          >
            Published ({articles.length})
          </button>
          <button
            className={`sidebar-tab ${tab === 'drafts' ? 'active' : ''}`}
            onClick={() => setTab('drafts')}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        <div className="sidebar-content">
          <button className="new-article-btn" onClick={onNewArticle}>
            + New Article
          </button>

          {isLoading ? (
            <div className="sidebar-loading">Loading from relays...</div>
          ) : items.length === 0 ? (
            <div className="sidebar-empty">
              {tab === 'articles'
                ? 'No published articles yet. Write something!'
                : 'No drafts saved to relays.'}
            </div>
          ) : (
            <ul className="article-list">
              {items.map(article => (
                <li key={article.slug} className="article-list-item">
                  {confirmDelete === article.slug ? (
                    <div className="article-confirm-delete">
                      <span>Delete "{article.title.slice(0, 30)}{article.title.length > 30 ? '…' : ''}"?</span>
                      <div className="confirm-actions">
                        <button
                          className="confirm-yes"
                          onClick={() => {
                            onDeleteArticle(article)
                            setConfirmDelete(null)
                          }}
                        >
                          Delete
                        </button>
                        <button
                          className="confirm-no"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="article-item-row">
                      <button
                        className="article-item"
                        onClick={() => onLoadArticle(article)}
                      >
                        <span className="article-title">{article.title}</span>
                        <span className="article-date">
                          {formatDate(article.createdAt)}
                        </span>
                      </button>
                      <button
                        className="article-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(article.slug)
                        }}
                        title="Delete article"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
