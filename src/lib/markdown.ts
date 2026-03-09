// HTML ↔ Markdown conversion for NIP-23

import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

// HTML → Markdown (for publishing to nostr)
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

// Keep nostr: URIs intact
turndown.addRule('nostrLinks', {
  filter: (node) => {
    return node.nodeName === 'A' && (node.getAttribute('href')?.startsWith('nostr:') ?? false)
  },
  replacement: (_content, node) => {
    const href = (node as HTMLAnchorElement).getAttribute('href')
    return href || ''
  },
})

export function htmlToMarkdown(html: string): string {
  // NIP-23 rule: no hard line breaks in paragraphs
  return turndown.turndown(html)
}

// Markdown → HTML (for loading into Tiptap editor)
const md = new MarkdownIt({
  html: false, // NIP-23: no HTML in markdown
  linkify: true,
  typographer: true,
})

export function markdownToHtml(markdown: string): string {
  const raw = md.render(markdown)
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'strong', 'em', 'del', 's',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  })
}
