"use client";

import { ReactNode } from "react";
import Link from "next/link";

type Props = {
  children: ReactNode;
  schoolName?: string;
  title?: string;
  activeNav?: string;
};

const navItems = [
  { label: "Main Page", href: "/" },
  { label: "News", href: "/news" },
  { label: "About", href: "/about" },
  { label: "Timetable", href: "/view-timetable" },
  { label: "Contact", href: "/contact" },
];

export default function EduPageLayout({
  children,
  schoolName = "ADASTRA SECONDARY SCHOOL",
  title = "Timetable",
  activeNav = "/view-timetable",
}: Props) {
  return (
    <div className="edupage-replica">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');

        .edupage-replica {
          font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
          min-height: 100vh;
          background: #f5f5f5;
          margin: 0;
          padding: 0;
        }

        .edupage-top-bar {
          background: #ea6645;
          padding: 8px 20px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 16px;
        }

        .edupage-lang-btn {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .edupage-lang-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .edupage-font-btns {
          display: flex;
          gap: 4px;
        }

        .edupage-font-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .edupage-font-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .edupage-main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
        }

        .edupage-logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .edupage-logo {
          width: 48px;
          height: 48px;
          background: #ea6645;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: bold;
          font-size: 20px;
        }

        .edupage-school-name {
          font-size: 18px;
          font-weight: 700;
          color: #111;
        }

        .edupage-nav-menu {
          display: flex;
          gap: 0;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          overflow: hidden;
          background: #fff;
        }

        .edupage-nav-item {
          padding: 10px 20px;
          text-decoration: none;
          color: #333;
          font-size: 14px;
          font-weight: 500;
          border-right: 1px solid #e0e0e0;
          transition: all 0.2s;
          cursor: pointer;
        }

        .edupage-nav-item:last-child {
          border-right: none;
        }

        .edupage-nav-item:hover {
          background: #f5f5f5;
        }

        .edupage-nav-item.active {
          background: #ea6645;
          color: #fff;
        }

        .edupage-breadcrumb-bar {
          background: #fafafa;
          padding: 10px 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .edupage-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #666;
        }

        .edupage-breadcrumb a {
          color: #ea6645;
          text-decoration: none;
        }

        .edupage-breadcrumb a:hover {
          text-decoration: underline;
        }

        .edupage-content {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .edupage-footer {
          background: #fff;
          border-top: 1px solid #e0e0e0;
          padding: 20px;
          margin-top: 40px;
        }

        .edupage-footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .edupage-footer-links {
          display: flex;
          gap: 20px;
          font-size: 13px;
        }

        .edupage-footer-links a {
          color: #666;
          text-decoration: none;
        }

        .edupage-footer-links a:hover {
          color: #ea6645;
        }

        .edupage-footer-powered {
          font-size: 12px;
          color: #999;
        }

        .edupage-footer-powered a {
          color: #ea6645;
          text-decoration: none;
        }

        .edupage-footer-left {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }

        .edupage-footer-left a {
          color: #666;
          text-decoration: none;
        }

        .edupage-footer-left a:hover {
          color: #ea6645;
        }

        .edupage-accessibility {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .edupage-accessibility a {
          color: inherit;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .edupage-font-btn-footer {
          background: none;
          border: 1px solid #ddd;
          color: #666;
          width: 24px;
          height: 24px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
        }

        .edupage-font-btn-footer:hover {
          background: #f0f0f0;
        }

        @media (max-width: 768px) {
          .edupage-top-bar {
            justify-content: center;
          }

          .edupage-main-header {
            flex-direction: column;
            gap: 12px;
          }

          .edupage-nav-menu {
            flex-wrap: wrap;
          }

          .edupage-content {
            padding: 16px;
          }

          .edupage-footer-content {
            flex-direction: column;
            text-align: center;
          }

          .edupage-footer-links {
            flex-wrap: wrap;
            justify-content: center;
          }

          .edupage-footer-left {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>

      <div className="edupage-top-bar">
        <button className="edupage-lang-btn">
          <span>EN</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div className="edupage-font-btns">
          <button className="edupage-font-btn" title="Increase font size">A+</button>
          <button className="edupage-font-btn" title="Decrease font size">A-</button>
          <button className="edupage-font-btn" title="High contrast">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </button>
        </div>
        <a href="/login" className="edupage-lang-btn">Login</a>
      </div>

      <header className="edupage-main-header">
        <div className="edupage-logo-section">
          <div className="edupage-logo">{schoolName.charAt(0)}</div>
          <span className="edupage-school-name">{schoolName}</span>
        </div>

        <nav className="edupage-nav-menu">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`edupage-nav-item ${activeNav === item.href ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="edupage-breadcrumb-bar">
        <div className="edupage-breadcrumb">
          <Link href="/">Main Page</Link>
          <span>/</span>
          <Link href="/dashboard">Students and parents</Link>
          <span>/</span>
          <Link href="/view-timetable">Everyday info</Link>
          <span>/</span>
          <span>{title}</span>
        </div>
      </div>

      <main className="edupage-content">
        {children}
      </main>

      <footer className="edupage-footer">
        <div className="edupage-footer-content">
          <div className="edupage-footer-left">
            <div className="edupage-accessibility">
              <a href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="4" r="2"/>
                  <path d="M12 6v6m0 0l-2 8m2-8l2 8"/>
                </svg>
                Disability friendly version
              </a>
              <button className="edupage-font-btn-footer" title="Increase font size">+</button>
              <button className="edupage-font-btn-footer" title="Decrease font size">-</button>
              <button className="edupage-font-btn-footer" title="High contrast">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="edupage-footer-links">
            <a href="mailto:webmaster@smarttech.com">Webmaster</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/sitemap">Site map</a>
          </div>
          <div className="edupage-footer-powered">
            Powered by <a href="https://smarttech.com" target="_blank">Smart Tech SaaS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
