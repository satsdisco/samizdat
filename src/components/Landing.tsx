import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
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
        <div className="landing-nav-links">
          <Link to="/read" className="landing-nav-link">Read the Press</Link>
          <button className="landing-cta-sm" onClick={onGetStarted}>
            Start Writing
          </button>
        </div>
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

      {/* Features — newspaper broadsheet style */}
      <section className="features-section">
        <div className="features-masthead">
          <div className="masthead-rule" />
          <h2>THE SAMIZDAT DISPATCH</h2>
          <p className="masthead-subtitle">What makes this different from every other writing tool</p>
          <div className="masthead-rule" />
        </div>

        <div className="broadsheet">
          <div className="broadsheet-col lead-col">
            <div className="article-block">
              <span className="article-num">I.</span>
              <h3>Your Keys Are Your Passport</h3>
              <p>
                No email. No password. No account to create or delete.
                Sign in with your nostr identity — a cryptographic key pair
                that you own forever. No platform can lock you out
                of your own name.
              </p>
            </div>
            <div className="col-divider" />
            <div className="article-block">
              <span className="article-num">II.</span>
              <h3>Published Across the World</h3>
              <p>
                Your articles live on nostr relays — independent servers
                run by people everywhere. Not one company's database.
                Take down one relay, the words live on a hundred others.
                There is no kill switch.
              </p>
            </div>
          </div>

          <div className="broadsheet-col">
            <div className="article-block">
              <span className="article-num">III.</span>
              <h3>The Tool Disappears</h3>
              <p>
                A writer-first editor that gets out of the way.
                Rich formatting, drag-and-drop images, live preview.
                No dashboards, no analytics panels, no engagement metrics.
                Just you and the words.
              </p>
            </div>
            <div className="col-divider" />
            <div className="article-block">
              <span className="article-num">IV.</span>
              <h3>Sign From Your Phone</h3>
              <p>
                Scan a QR code with Amber or any nostr signer.
                Your private key never touches the browser.
                Approve each publication from your pocket.
              </p>
            </div>
          </div>

          <div className="broadsheet-col">
            <div className="article-block">
              <span className="article-num">V.</span>
              <h3>Images Without Permission</h3>
              <p>
                Drag, drop, or paste images right into the text.
                They upload to decentralized hosting — no accounts,
                no content policies, no takedowns. Permanent by default.
              </p>
            </div>
            <div className="col-divider" />
            <div className="article-block">
              <span className="article-num">VI.</span>
              <h3>Living Documents</h3>
              <p>
                Save drafts to relays. Pick up on any device.
                Edit and republish — your articles evolve with you.
                Every version signed, every change yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reader Preview */}
      <section className="reader-section">
        <div className="reader-intro">
          <h2>A beautiful place to read</h2>
          <p>
            Every article published on Samizdat gets a clean, distraction-free reader.
            Serif typography. No ads. No pop-ups. Just the writing.
          </p>
          <Link to="/read" className="reader-cta">
            Browse the Press →
          </Link>
        </div>

        <div className="reader-preview-window">
          <div className="window-chrome">
            <div className="window-dots">
              <span /><span /><span />
            </div>
            <div className="window-url">samizdat.press/a/naddr1...</div>
          </div>
          <div className="reader-preview-body">
            <div className="mock-reader-banner" />
            <div className="mock-reader-meta">
              <div className="mock-reader-avatar" />
              <div className="mock-reader-author">
                <div className="mock-line w60" style={{ height: '10px', marginBottom: '4px' }} />
                <div className="mock-line w40" style={{ height: '7px', opacity: 0.4 }} />
              </div>
            </div>
            <h3 className="mock-reader-title">Freedom is a beautiful thing</h3>
            <div className="mock-reader-text">
              <div className="mock-line w100" />
              <div className="mock-line w95" />
              <div className="mock-line w88" />
              <div className="mock-line w100" />
              <div className="mock-line w72" />
              <div className="mock-spacer" />
              <div className="mock-line w100" />
              <div className="mock-line w90" />
              <div className="mock-line w60" />
            </div>
            <div className="mock-reader-actions">
              <span className="mock-zap-btn">⚡ Zap</span>
              <span className="mock-comment-btn">💬 Comments</span>
            </div>
          </div>
        </div>
      </section>

      {/* Zap-Gated Content */}
      <section className="zapgate-section">
        <div className="zapgate-content">
          <div className="zapgate-text">
            <h2>Get paid for your words</h2>
            <p>
              Set a price in sats. Readers see a preview, then unlock the full
              article with a lightning zap. No middleman takes a cut. No payment
              processor approves your content. Peer-to-peer, instant, global.
            </p>
            <div className="zapgate-features">
              <div className="zapgate-feature">
                <span className="zapgate-icon">⚡</span>
                <div>
                  <strong>Lightning-native payments</strong>
                  <p>Readers zap sats directly to your wallet. You set the price.</p>
                </div>
              </div>
              <div className="zapgate-feature">
                <span className="zapgate-icon">🔒</span>
                <div>
                  <strong>Preview + paywall</strong>
                  <p>Choose how much to show for free. The rest unlocks after payment.</p>
                </div>
              </div>
              <div className="zapgate-feature">
                <span className="zapgate-icon">🌐</span>
                <div>
                  <strong>No platform dependency</strong>
                  <p>Your content, your relay, your rules. No approval process.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="zapgate-preview">
            <div className="zapgate-card">
              <div className="zapgate-card-text">
                <div className="mock-line w100" />
                <div className="mock-line w95" />
                <div className="mock-line w88" />
                <div className="mock-line w72" />
              </div>
              <div className="zapgate-fade" />
              <div className="zapgate-paywall">
                <span className="paywall-icon">⚡</span>
                <span className="paywall-label">Unlock for 500 sats</span>
                <span className="paywall-sub">Zap to read the full article</span>
              </div>
            </div>
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
