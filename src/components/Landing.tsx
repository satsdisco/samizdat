import { useState, useEffect, useRef } from 'react'
import './Landing.css'

interface LandingProps {
  onGetStarted: () => void
}

export function Landing({ onGetStarted }: LandingProps) {
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <span className="landing-wordmark">samizdat</span>
        <button className="landing-cta-sm" onClick={onGetStarted}>
          Start Writing
        </button>
      </nav>

      {/* Hero */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg">
          <div className="hero-grain" />
          <div
            className="hero-gradient"
            style={{ transform: `translateY(${scrollY * 0.3}px)` }}
          />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="eyebrow-line" />
            <span>Uncensorable Publishing</span>
            <span className="eyebrow-line" />
          </div>

          <h1 className="hero-title">
            <span className="title-line">Your words.</span>
            <span className="title-line">Your keys.</span>
            <span className="title-line accent">Your press.</span>
          </h1>

          <p className="hero-subtitle">
            A distraction-free writing tool built on nostr.
            No accounts. No censorship. No permission needed.
            Just you and your words, published to the world.
          </p>

          <div className="hero-actions">
            <button className="cta-primary" onClick={onGetStarted}>
              Start Writing
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <a className="cta-secondary" href="https://nostr.com" target="_blank" rel="noopener noreferrer">
              What is Nostr?
            </a>
          </div>
        </div>

        <div className="hero-scroll-hint">
          <span>Scroll</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* Hero Image */}
      <section className="hero-image-section">
        <div className="hero-image-wrapper">
          <img src="/hero.png" alt="A figure holding a pen like a sword, breaking free from chains — Soviet constructivist style" />
        </div>
      </section>

      {/* Editor Preview */}
      <section className="preview-section">
        <div className="preview-window">
          <div className="window-chrome">
            <div className="window-dots">
              <span /><span /><span />
            </div>
            <div className="window-url">samizdat.press</div>
          </div>
          <div className="window-body">
            <div className="mock-titlebar">
              <span className="mock-logo">samizdat</span>
              <span className="mock-wordcount">847 words</span>
              <span className="mock-publish-btn">Publish</span>
            </div>
            <div className="mock-editor">
              <div className="mock-banner" />
              <h1 className="mock-title">The Right to Speak Freely</h1>
              <div className="mock-text">
                <div className="mock-line w100" />
                <div className="mock-line w95" />
                <div className="mock-line w88" />
                <div className="mock-line w100" />
                <div className="mock-line w72" />
                <div className="mock-spacer" />
                <div className="mock-line w100" />
                <div className="mock-line w90" />
                <div className="mock-line w96" />
                <div className="mock-line w60" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="features-header">
          <h2>Built for writers who refuse to be silenced</h2>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Your Keys, Your Identity</h3>
            <p>
              Sign in with your nostr identity. No email, no password, no account.
              Your cryptographic keys are your passport — own them forever.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h3>Published Everywhere</h3>
            <p>
              Your articles live on nostr relays around the world, not on a single server.
              No one can take them down. No one can shut you off.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </div>
            <h3>Writer-First Editor</h3>
            <p>
              Beautiful, distraction-free writing with rich formatting.
              Drag in images, preview your article, publish when ready.
              The tool disappears so the writing can breathe.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Sign from Your Phone</h3>
            <p>
              Use a mobile signer like Amber to approve publications.
              Your private key never touches the browser. Scan a QR code and go.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <h3>Images Built In</h3>
            <p>
              Drag, drop, or paste images directly into your article.
              They're uploaded to nostr-native hosting — permanent, decentralized, free.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h3>Drafts & History</h3>
            <p>
              Save drafts to nostr relays, pick up where you left off on any device.
              Edit and republish — your articles are living documents.
            </p>
          </div>
        </div>
      </section>

      {/* Manifesto section */}
      <section className="manifesto-section">
        <div className="manifesto-content">
          <blockquote className="manifesto-quote">
            "Samizdat — I myself publish it"
          </blockquote>
          <p className="manifesto-text">
            In the Soviet era, samizdat was the practice of secretly copying and
            distributing censored literature by hand. Writers risked everything to
            share forbidden ideas. Today, the tools have changed but the fight hasn't.
            Governments and platforms still silence voices. Nostr changes the equation:
            cryptographic identity, distributed relays, no kill switch.
          </p>
          <p className="manifesto-text">
            This is your printing press. Use it.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta-section">
        <h2>Ready to publish?</h2>
        <p>No sign-up. No approval. No permission.</p>
        <button className="cta-primary large" onClick={onGetStarted}>
          Start Writing Now
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-wordmark">samizdat</span>
          <div className="footer-links">
            <a href="https://github.com/satsdisco/samizdat" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://nostr.com" target="_blank" rel="noopener noreferrer">Nostr</a>
            <a href="https://njump.me" target="_blank" rel="noopener noreferrer">Browse Articles</a>
          </div>
          <p className="footer-tagline">
            Built with nostr. Published forever.
          </p>
        </div>
      </footer>
    </div>
  )
}
