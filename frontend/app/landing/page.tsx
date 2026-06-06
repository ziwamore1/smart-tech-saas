'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './landing.css';
import { galleryApi } from '@/lib/api';

type Language = 'en' | 'de' | 'es';

const LANGUAGES: Record<Language, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  es: { label: 'Español', flag: '🇪🇸' },
};

interface GalleryEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  photos: { id: string; url: string; caption: string | null }[];
}

const FALLBACK_EVENTS = [
  {
    id: '1',
    title: 'Annual Science Fair',
    description: 'Students showcase their innovative science projects with live demonstrations and experiments.',
    eventDate: '2026-06-15T00:00:00.000Z',
    photos: [],
  },
  {
    id: '2',
    title: 'Sports Day Championship',
    description: 'Annual inter-house sports competition featuring athletics, team sports and fun activities.',
    eventDate: '2026-07-20T00:00:00.000Z',
    photos: [],
  },
  {
    id: '3',
    title: 'Parent-Teacher Conference',
    description: 'Meet your child\'s teachers to discuss academic progress and development plans.',
    eventDate: '2026-08-05T00:00:00.000Z',
    photos: [],
  },
  {
    id: '4',
    title: 'Cultural Day Celebration',
    description: 'Celebrating diversity with traditional music, dance, food and cultural presentations.',
    eventDate: '2026-09-12T00:00:00.000Z',
    photos: [],
  },
  {
    id: '5',
    title: 'Graduation Ceremony',
    description: 'Honoring our graduating students with awards, speeches and a formal ceremony.',
    eventDate: '2026-11-28T00:00:00.000Z',
    photos: [],
  },
  {
    id: '6',
    title: 'Tech Innovation Workshop',
    description: 'Hands-on workshop on robotics, coding, and emerging technologies for students.',
    eventDate: '2026-10-10T00:00:00.000Z',
    photos: [],
  },
];

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [scrolled, setScrolled] = useState(false);
  const [galleryEvents, setGalleryEvents] = useState<GalleryEvent[]>(FALLBACK_EVENTS);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await galleryApi.getRecentEvents(10);
        if (data && data.length > 0) {
          setGalleryEvents(data);
        }
      } catch {
        console.log('Gallery API unavailable, showing fallback');
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  const scrollEvents = (dir: 'left' | 'right') => {
    if (!trackRef.current) return;
    const amount = 340;
    trackRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchQuery);
  };

  return (
    <div className="landing-container">
      {/* ========== HEADER ========== */}
      <header className={`landing-header${scrolled ? ' scrolled' : ''}`}>
        <div className="landing-header-content">
          {/* Top bar */}
          <div className="landing-top-bar">
            <div className="landing-language-chooser">
              {(Object.entries(LANGUAGES) as [Language, { label: string; flag: string }][]).map(([key, { label, flag }]) => (
                <button
                  key={key}
                  className={`landing-language-btn${lang === key ? ' active' : ''}`}
                  onClick={() => setLang(key)}
                >
                  <span className="lang-flag">{flag}</span>
                  {label}
                </button>
              ))}
            </div>
            <Link href="/login" className="landing-login-link">
              Sign In
            </Link>
          </div>

          {/* Nav bar */}
          <div className="landing-nav-bar">
            <div className="landing-logo-section">
              <img src="/smart_tech_logo.png" alt="Smart Tech SaaS" className="landing-logo-img" />
              <span className="landing-school-name">
                Smart Tech SaaS
                <br />
                <small>School Management System</small>
              </span>
            </div>

            <nav className="landing-main-nav">
              <ul className="landing-nav-menu">
                <li className="landing-nav-item">
                  <Link href="#" className="landing-nav-link">Main Page</Link>
                </li>
                <li className="landing-nav-item">
                  <Link href="#" className="landing-nav-link">News</Link>
                </li>
                <li className="landing-nav-item">
                  <Link href="#" className="landing-nav-link">
                    About School <i className="fa fa-caret-down" />
                  </Link>
                  <div className="landing-nav-dropdown">
                    <div className="landing-dropdown-section">
                      <div className="landing-dropdown-title">Basic Info</div>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Our Profile</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Achievements</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Partners</Link>
                    </div>
                    <div className="landing-dropdown-section">
                      <div className="landing-dropdown-title">Admissions</div>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Why Us?</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Criteria</Link>
                      <Link href="/register" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Application</Link>
                    </div>
                  </div>
                </li>
                <li className="landing-nav-item">
                  <Link href="#" className="landing-nav-link">
                    Students &amp; Parents <i className="fa fa-caret-down" />
                  </Link>
                  <div className="landing-nav-dropdown">
                    <div className="landing-dropdown-section">
                      <div className="landing-dropdown-title">Everyday Info</div>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Calendar</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Substitution</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Timetable</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Grades</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Homework</Link>
                    </div>
                    <div className="landing-dropdown-section">
                      <div className="landing-dropdown-title">School Life</div>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Photo Album</Link>
                      <Link href="#" className="landing-dropdown-item"><i className="fa fa-caret-right" /> Digital Library</Link>
                    </div>
                  </div>
                </li>
                <li className="landing-nav-item">
                  <Link href="#" className="landing-nav-link">Contact</Link>
                </li>
              </ul>
            </nav>

            <form onSubmit={handleSearch} className="landing-search-box">
              <input
                type="text"
                placeholder="Search..."
                className="landing-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="landing-search-btn">
                <i className="fa fa-search" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-grid">
            <div className="landing-hero-text">
              <h1>
                Modern School Management<br />
                <span>Made Simple</span>
              </h1>
              <p>
                Smart Tech SaaS provides comprehensive school management solutions for
                educational institutions. Manage students, teachers, timetables, grades,
                and communications all in one powerful platform.
              </p>
              <div className="landing-hero-buttons">
                <button onClick={() => setShowRoleModal(true)} className="landing-btn-primary">
                  Get Started Free
                </button>
                <Link href="/login" className="landing-btn-secondary">
                  Sign In
                </Link>
              </div>
            </div>
            <div className="landing-hero-image">
              <div className="landing-hero-visual">
                <div className="landing-hero-features">
                  <div className="landing-feature-card">
                    <span className="landing-feature-icon">📊</span>
                    <div className="landing-feature-title">Analytics</div>
                    <div className="landing-feature-desc">Real-time insights</div>
                  </div>
                  <div className="landing-feature-card">
                    <span className="landing-feature-icon">📅</span>
                    <div className="landing-feature-title">Timetables</div>
                    <div className="landing-feature-desc">Smart scheduling</div>
                  </div>
                  <div className="landing-feature-card">
                    <span className="landing-feature-icon">📱</span>
                    <div className="landing-feature-title">Mobile</div>
                    <div className="landing-feature-desc">Access anywhere</div>
                  </div>
                  <div className="landing-feature-card">
                    <span className="landing-feature-icon">🔒</span>
                    <div className="landing-feature-title">Secure</div>
                    <div className="landing-feature-desc">Protected data</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== STATS ========== */}
      <div className="landing-stats">
        <div className="landing-stats-grid">
          <div className="landing-stat-item">
            <div className="landing-stat-number">500+</div>
            <div className="landing-stat-label">Schools</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">50K+</div>
            <div className="landing-stat-label">Students</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">5K+</div>
            <div className="landing-stat-label">Teachers</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">99.9%</div>
            <div className="landing-stat-label">Uptime</div>
          </div>
        </div>
      </div>

      {/* ========== FEATURES ========== */}
      <main className="landing-content">
        <h2 className="landing-section-title">Everything You Need for School Management</h2>
        <p className="landing-section-subtitle">
          A complete platform designed to streamline every aspect of running an educational institution.
        </p>

        <div className="landing-info-grid">
          <div className="landing-info-card">
            <div className="landing-info-icon">👨‍🎓</div>
            <h3>Student Management</h3>
            <p>
              Complete student lifecycle management from enrollment to graduation.
              Track attendance, grades, and personal development.
            </p>
          </div>
          <div className="landing-info-card">
            <div className="landing-info-icon">👨‍🏫</div>
            <h3>Teacher Portal</h3>
            <p>
              Empower teachers with tools to manage classes, input grades,
              assign homework, and communicate with parents.
            </p>
          </div>
          <div className="landing-info-card">
            <div className="landing-info-icon">📅</div>
            <h3>Smart Timetables</h3>
            <p>
              AI-powered timetable generation that considers constraints,
              teacher availability, and classroom allocation.
            </p>
          </div>
          <div className="landing-info-card">
            <div className="landing-info-icon">📝</div>
            <h3>Assessment &amp; Results</h3>
            <p>
              Comprehensive grading system with customizable rubrics,
              automatic calculations, and detailed report cards.
            </p>
          </div>
          <div className="landing-info-card">
            <div className="landing-info-icon">💬</div>
            <h3>Communications</h3>
            <p>
              Built-in SMS, email, and push notifications to keep parents
              informed about student progress and school events.
            </p>
          </div>
          <div className="landing-info-card">
            <div className="landing-info-icon">📈</div>
            <h3>Analytics Dashboard</h3>
            <p>
              Real-time insights into school performance, student metrics,
              and actionable data for better decision-making.
            </p>
          </div>
        </div>
      </main>

      {/* ========== EVENTS / ACTIVITIES ========== */}
      <div className="landing-events">
        <div className="landing-events-header">
          <div>
            <h2>School Events &amp; Activities</h2>
            <p>Moments that make our school community vibrant</p>
          </div>
          <div className="landing-events-nav">
            <button onClick={() => scrollEvents('left')} aria-label="Previous">←</button>
            <button onClick={() => scrollEvents('right')} aria-label="Next">→</button>
          </div>
        </div>

        <div className="landing-events-track" ref={trackRef}>
          {loadingEvents ? (
            <div className="landing-events-loading">Loading events...</div>
          ) : (
            galleryEvents.map((event) => {
              const photo = event.photos?.[0];
              const eventDate = event.eventDate
                ? new Date(event.eventDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Coming soon';
              return (
                <div key={event.id} className="landing-event-card">
                  {photo ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || event.title}
                      className="landing-event-image"
                    />
                  ) : (
                    <div className="landing-event-image-placeholder">📅</div>
                  )}
                  <div className="landing-event-info">
                    <div className="landing-event-date">{eventDate}</div>
                    <div className="landing-event-title">{event.title}</div>
                    <p className="landing-event-desc">{event.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========== CTA ========== */}
      <div className="landing-cta">
        <h2>Ready to Transform Your School?</h2>
        <p>Join hundreds of schools already using Smart Tech SaaS to manage their educational operations.</p>
        <div className="landing-cta-buttons">
          <button onClick={() => setShowRoleModal(true)} className="landing-btn-primary">
            Get Started Free
          </button>
          <Link href="/login" className="landing-btn-secondary" style={{ color: '#374151', borderColor: '#d1d5db', background: '#fff' }}>
            Contact Sales
          </Link>
        </div>
      </div>

      {/* ========== FOOTER ========== */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-grid">
            <div className="landing-footer-section">
              <h4>Smart Tech SaaS</h4>
              <p>
                Empowering educational institutions with modern, scalable, and
                intuitive school management solutions.
              </p>
              <div style={{ marginTop: '20px' }}>
                <Link href="/register" className="landing-btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                  Get Started
                </Link>
              </div>
            </div>
            <div className="landing-footer-section">
              <h4>Quick Links</h4>
              <ul className="landing-footer-links">
                <li><Link href="/login">Login</Link></li>
                <li><Link href="/register">Register School</Link></li>
                <li><Link href="#">Features</Link></li>
                <li><Link href="#">Pricing</Link></li>
                <li><Link href="#">Contact</Link></li>
              </ul>
            </div>
            <div className="landing-footer-section">
              <h4>Support</h4>
              <ul className="landing-footer-links">
                <li><Link href="#">Help Center</Link></li>
                <li><Link href="#">Documentation</Link></li>
                <li><Link href="#">API Reference</Link></li>
                <li><Link href="#">Status Page</Link></li>
              </ul>
            </div>
            <div className="landing-footer-section">
              <h4>Contact Us</h4>
              <div className="landing-contact-item">
                <i className="fa fa-envelope" />
                <span>support@smarttechsaas.com</span>
              </div>
              <div className="landing-contact-item">
                <i className="fa fa-envelope" />
                <span>noreply@smarttechsaas.com</span>
              </div>
              <div className="landing-contact-item">
                <i className="fa fa-user-shield" />
                <span>superadmin@smarttechsaas.com</span>
              </div>
              <div className="landing-contact-item">
                <i className="fa fa-phone" />
                <span>+260 978805917</span>
              </div>
              <div className="landing-contact-item">
                <i className="fa fa-map-marker" />
                <span>123 Education Street<br />Learning City, LC 12345</span>
              </div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <p>© 2026 Smart Tech SaaS. All rights reserved.</p>
            <p>
              <Link href="#">Privacy Policy</Link> · <Link href="#">Terms of Service</Link> · <Link href="#">Cookie Policy</Link>
            </p>
          </div>
        </div>
      </footer>

      {/* ========== ROLE MODAL ========== */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Welcome to Smart Tech SaaS</h2>
              <p>Choose how you want to get started</p>
              <button className="modal-close" onClick={() => setShowRoleModal(false)}>×</button>
            </div>
            <div className="modal-options">
              <div className="modal-option" onClick={() => { router.push('/super-admin-register'); setShowRoleModal(false); }}>
                <div className="modal-option-icon">🏢</div>
                <h3>System Owner</h3>
                <p>Register as a system owner to create and manage schools</p>
              </div>
              <div className="modal-option" onClick={() => { router.push('/register'); setShowRoleModal(false); }}>
                <div className="modal-option-icon">🏫</div>
                <h3>School Director</h3>
                <p>Register a new school with your director account</p>
              </div>
              <div className="modal-option" onClick={() => { router.push('/login'); setShowRoleModal(false); }}>
                <div className="modal-option-icon">👤</div>
                <h3>Existing User</h3>
                <p>Login to your existing account</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: #fefcf9;
          border-radius: 16px;
          padding: 32px;
          max-width: 600px;
          width: 90%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: modalSlideIn 0.3s ease;
        }
        @keyframes modalSlideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-header {
          text-align: center;
          margin-bottom: 32px;
          position: relative;
        }
        .modal-header h2 {
          font-size: 28px;
          color: #1e3a8a;
          margin-bottom: 8px;
        }
        .modal-header p {
          color: #6b7280;
          font-size: 16px;
        }
        .modal-close {
          position: absolute;
          top: 0; right: 0;
          background: none;
          border: none;
          font-size: 32px;
          cursor: pointer;
          color: #9ca3af;
          line-height: 1;
        }
        .modal-close:hover { color: #374151; }
        .modal-options { display: grid; gap: 16px; }
        .modal-option {
          padding: 20px;
          border: 2px solid #e8ddd0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .modal-option:hover {
          border-color: #667eea;
          background: #f5f3ff;
          transform: translateX(4px);
        }
        .modal-option-icon {
          font-size: 32px;
          width: 56px; height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border-radius: 12px;
          flex-shrink: 0;
        }
        .modal-option h3 { font-size: 18px; color: #1f2937; margin-bottom: 4px; }
        .modal-option p { font-size: 14px; color: #6b7280; margin: 0; }
      `}</style>
    </div>
  );
}
