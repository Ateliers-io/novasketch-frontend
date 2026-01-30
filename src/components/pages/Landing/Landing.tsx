/**
 * Landing Page - Premium SaaS-style design
 * Inspired by Linear, Vercel, and Figma aesthetics
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts';
import './Landing.css';

export const Landing = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const heroRef = useRef<HTMLElement>(null);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        if (isAuthenticated) navigate('/home');
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="landing">
            {/* Gradient Orbs Background */}
            <div className="landing__orbs" aria-hidden="true">
                <div className="orb orb--purple" />
                <div className="orb orb--blue" />
                <div className="orb orb--pink" />
            </div>

            {/* Grid Pattern Overlay */}
            <div className="landing__grid" aria-hidden="true" />

            {/* Navigation */}
            <header className="header">
                <nav className="header__nav">
                    <div className="header__brand">
                        <div className="logo">
                            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="40" height="40" rx="10" fill="url(#logo-gradient)" />
                                <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" fillOpacity="0.9" />
                                <path d="M18 20L24 14L30 20L24 26L18 20Z" fill="white" fillOpacity="0.6" />
                                <defs>
                                    <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40">
                                        <stop stopColor="#6366f1" />
                                        <stop offset="1" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="header__name">NovaSketch</span>
                    </div>

                    <div className="header__menu">
                        <a href="#features" className="header__link">Features</a>
                        <a href="#workflow" className="header__link">Workflow</a>
                        <a href="#pricing" className="header__link">Pricing</a>
                    </div>

                    <div className="header__actions">
                        <button className="header__btn header__btn--text" onClick={() => navigate('/auth')}>
                            Log in
                        </button>
                        <button className="header__btn header__btn--primary" onClick={() => navigate('/auth')}>
                            Start free
                        </button>
                    </div>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="hero" ref={heroRef}>
                <div className="hero__announcement">
                    <span className="hero__tag">New</span>
                    <span>Real-time collaboration is here</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                </div>

                <h1 className="hero__title">
                    <span className="hero__title-line">Collaborative canvas</span>
                    <span className="hero__title-line hero__title-line--gradient">
                        for creative teams
                    </span>
                </h1>

                <p className="hero__subtitle">
                    Sketch, brainstorm, and design together in real-time.
                    NovaSketch brings your team's ideas to life with a
                    minimal, distraction-free infinite canvas.
                </p>

                <div className="hero__cta">
                    <button className="cta-btn cta-btn--primary" onClick={() => navigate('/auth')}>
                        <span>Start creating</span>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M4.167 10h11.666M10 4.167L15.833 10 10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button className="cta-btn cta-btn--secondary" onClick={() => navigate('/auth')}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 18.333A8.333 8.333 0 1010 1.667a8.333 8.333 0 000 16.666z" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M8.333 6.667l5 3.333-5 3.333V6.667z" fill="currentColor" />
                        </svg>
                        <span>Watch demo</span>
                    </button>
                </div>

                <div className="hero__stats">
                    <div className="hero__stat">
                        <span className="hero__stat-value">10K+</span>
                        <span className="hero__stat-label">Active users</span>
                    </div>
                    <div className="hero__stat-divider" />
                    <div className="hero__stat">
                        <span className="hero__stat-value">50M+</span>
                        <span className="hero__stat-label">Shapes drawn</span>
                    </div>
                    <div className="hero__stat-divider" />
                    <div className="hero__stat">
                        <span className="hero__stat-value">99.9%</span>
                        <span className="hero__stat-label">Uptime</span>
                    </div>
                </div>
            </section>

            {/* Product Preview */}
            <section className="preview-section">
                <div
                    className="preview-window"
                    style={{ transform: `translateY(${scrollY * 0.1}px)` }}
                >
                    <div className="preview-window__header">
                        <div className="preview-window__dots">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div className="preview-window__title">NovaSketch — Team Workspace</div>
                        <div className="preview-window__actions">
                            <span className="preview-window__share">Share</span>
                        </div>
                    </div>
                    <div className="preview-window__content">
                        {/* Animated Canvas Preview */}
                        <div className="canvas-preview">
                            <div className="canvas-preview__sidebar">
                                <div className="tool-icon tool-icon--active">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                    </svg>
                                </div>
                                <div className="tool-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                    </svg>
                                </div>
                                <div className="tool-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                    </svg>
                                </div>
                                <div className="tool-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </div>
                            </div>

                            <div className="canvas-preview__canvas">
                                {/* Animated elements */}
                                <div className="canvas-elem canvas-elem--rect" />
                                <div className="canvas-elem canvas-elem--circle" />
                                <div className="canvas-elem canvas-elem--arrow" />
                                <div className="canvas-elem canvas-elem--text">Brainstorm</div>

                                {/* Live cursors */}
                                <div className="live-cursor live-cursor--1">
                                    <svg viewBox="0 0 24 24" fill="#6366f1">
                                        <path d="M5.65 3L20 12L13 14L9 21L5.65 3Z" />
                                    </svg>
                                    <span className="live-cursor__name">Sarah</span>
                                </div>
                                <div className="live-cursor live-cursor--2">
                                    <svg viewBox="0 0 24 24" fill="#ec4899">
                                        <path d="M5.65 3L20 12L13 14L9 21L5.65 3Z" />
                                    </svg>
                                    <span className="live-cursor__name">Mike</span>
                                </div>
                            </div>

                            <div className="canvas-preview__users">
                                <div className="user-avatar" style={{ background: '#6366f1' }}>S</div>
                                <div className="user-avatar" style={{ background: '#ec4899' }}>M</div>
                                <div className="user-avatar" style={{ background: '#f59e0b' }}>A</div>
                                <div className="user-count">+5</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features">
                <div className="features__header">
                    <span className="section-tag">Features</span>
                    <h2 className="section-title">Everything you need to create together</h2>
                    <p className="section-desc">
                        Powerful collaboration tools wrapped in a beautiful,
                        intuitive interface.
                    </p>
                </div>

                <div className="features__grid">
                    <article className="feature-card feature-card--large">
                        <div className="feature-card__visual">
                            <div className="cursor-demo">
                                <div className="cursor-demo__cursor cursor-demo__cursor--1" />
                                <div className="cursor-demo__cursor cursor-demo__cursor--2" />
                                <div className="cursor-demo__cursor cursor-demo__cursor--3" />
                            </div>
                        </div>
                        <div className="feature-card__content">
                            <h3 className="feature-card__title">Real-time cursors</h3>
                            <p className="feature-card__desc">
                                See your team's cursors move in real-time.
                                Know exactly who's working where.
                            </p>
                        </div>
                    </article>

                    <article className="feature-card">
                        <div className="feature-card__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                        <h3 className="feature-card__title">Instant sync</h3>
                        <p className="feature-card__desc">
                            Every stroke syncs in milliseconds across all devices.
                        </p>
                    </article>

                    <article className="feature-card">
                        <div className="feature-card__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                            </svg>
                        </div>
                        <h3 className="feature-card__title">Works offline</h3>
                        <p className="feature-card__desc">
                            Keep creating without internet. Auto-sync when back online.
                        </p>
                    </article>

                    <article className="feature-card">
                        <div className="feature-card__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <path d="M8 21h8m-4-4v4" />
                            </svg>
                        </div>
                        <h3 className="feature-card__title">Infinite canvas</h3>
                        <p className="feature-card__desc">
                            Unlimited space to capture every idea, no matter how big.
                        </p>
                    </article>

                    <article className="feature-card">
                        <div className="feature-card__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <h3 className="feature-card__title">Secure by default</h3>
                        <p className="feature-card__desc">
                            End-to-end encryption keeps your work private.
                        </p>
                    </article>
                </div>
            </section>

            {/* CTA Section */}
            <section className="final-cta">
                <div className="final-cta__glow" />
                <h2 className="final-cta__title">Start creating today</h2>
                <p className="final-cta__desc">
                    Join thousands of teams already using NovaSketch
                </p>
                <button className="cta-btn cta-btn--large" onClick={() => navigate('/auth')}>
                    Get started for free
                </button>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer__inner">
                    <div className="footer__brand">
                        <div className="logo logo--small">
                            <svg viewBox="0 0 40 40" fill="none">
                                <rect width="40" height="40" rx="10" fill="url(#logo-gradient-footer)" />
                                <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" fillOpacity="0.9" />
                                <path d="M18 20L24 14L30 20L24 26L18 20Z" fill="white" fillOpacity="0.6" />
                                <defs>
                                    <linearGradient id="logo-gradient-footer" x1="0" y1="0" x2="40" y2="40">
                                        <stop stopColor="#6366f1" />
                                        <stop offset="1" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span>NovaSketch</span>
                    </div>
                    <p className="footer__copy">© 2026 NovaSketch. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
