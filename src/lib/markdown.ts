// HTML ↔ Markdown conversion for NIP-23

import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'

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
  return md.render(markdown)
}
