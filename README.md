# Samizdat

**самиздат** — *"self-published"*

A writer-first publishing tool for Nostr. Write long-form articles and publish them to the decentralized web — no accounts, no gatekeepers, no censorship.

Soviet dissidents hand-copied forbidden literature and passed it from reader to reader. Samizdat does the same thing at the speed of light.

**[samizdat.press](https://samizdat.press)**

---

## What is this?

A clean, focused editor that publishes [NIP-23](https://github.com/nostr-protocol/nips/blob/master/23.md) long-form content directly to Nostr relays. Your words live on relays you choose — not on a platform that can delete them.

No feed algorithm. No engagement metrics. No ads. Just writing.

## Features

**Editor**
- Rich text editing powered by Tiptap — bold, italic, headings, lists, code blocks, links
- Drag & drop and paste images directly into your article
- Image uploads to [nostr.build](https://nostr.build) with NIP-98 authentication
- Cover/banner image support
- Markdown under the hood (NIP-23 compatible)
- Auto-saving drafts to localStorage — your work is never lost
- Word count, article preview, relay status indicator

**Publishing**
- Publish articles (kind 30023) and drafts (kind 30024) to any Nostr relay
- NIP-65 relay list auto-discovery — uses your relay preferences
- Relay picker with read/write toggles and custom relay support
- Share links via `naddr` (NIP-19) — works with any Nostr client
- Article deletion via NIP-09

**Login**
- NIP-07 browser extension (Alby, nos2x, Nostr Connect)
- NIP-46 remote signer with QR code (Primal, Amber, nsec.app)
- Direct key import (nsec) with security warnings
- No account creation — your Nostr keys are your identity

**Reading**
- Beautiful article reader with serif typography
- NIP-22 comments with author avatars
- Zap button for articles (NIP-57 lightning tips)
- Press page — editorial feed with editor curation, social graph, and bookmarks

**Zap-Gated Articles**
- Set a sats price on any article
- Preview cutoff slider — show readers a taste before the paywall
- Split publishing: preview goes to public relays, full content to private relay

## Screenshots

Visit [samizdat.press](https://samizdat.press) to see it live.

## Stack

- **React** + **TypeScript** + **Vite**
- **Tiptap** — rich text editor
- **nostr-tools** — event signing, relay communication, NIP-19/46/65
- **Source Serif 4** + **Inter** + **JetBrains Mono** typography
- **React Router** — SPA with clean URLs

## Self-Hosting

```bash
git clone https://github.com/satsdisco/samizdat.git
cd samizdat
npm install
npm run dev
```

The app runs entirely in the browser. No backend server needed — it connects directly to Nostr relays.

To build for production:

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, or just nginx).

## How It Works

Samizdat is a client-side application. When you log in, your browser connects to Nostr relays and signs events locally using your keys. Articles are published as NIP-23 events (kind 30023) with markdown content, metadata tags, and optional images.

Nothing touches a server. Your keys never leave your device (unless you're using a remote signer, in which case they never leave *that* device).

## Contributing

Issues and PRs welcome. The codebase is straightforward React + TypeScript.

Key directories:
- `src/components/` — UI components (Editor, Press, ArticleReader, LoginScreen, etc.)
- `src/hooks/useNostr.ts` — authentication, relay management, publishing
- `src/lib/` — Nostr protocol utilities, markdown conversion, image uploads, article fetching

## Why "Samizdat"?

In the Soviet Union, samizdat was the practice of copying and distributing censored literature by hand. Writers typed manuscripts and passed them to readers who retyped them and passed them on. The state couldn't stop it because there was no publisher to shut down, no printing press to seize.

Nostr works the same way. Your article lives on multiple relays run by different people in different countries. There's no company to pressure, no terms of service to violate, no algorithm to suppress your reach. You write it, sign it with your keys, and it's out there.

Freedom is a beautiful thing.

## License

MIT
