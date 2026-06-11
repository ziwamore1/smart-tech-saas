'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';

const navLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'FAQ', href: '/faq' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100' : 'bg-transparent'
      }`}
    >
      <div className="container-main">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">ST</span>
            </div>
            <span className={`font-bold text-lg tracking-tight ${scrolled ? 'text-text' : 'text-white'}`}>
              SMART<span className="gradient-text">_TECH</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  scrolled ? 'text-text-secondary hover:text-primary hover:bg-primary/5' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Button
              href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'}
              variant={scrolled ? 'ghost' : 'ghost'}
              size="sm"
              external
              className={scrolled ? 'text-text-secondary hover:text-primary' : 'text-white/70 hover:text-white'}
            >
              Sign In
            </Button>
            <Button
              href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'}
              variant="primary"
              size="sm"
              external
            >
              Get Started
            </Button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              scrolled ? 'text-text hover:bg-gray-100' : 'text-white hover:bg-white/10'
            }`}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="container-main py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/5 font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <hr className="my-3 border-gray-100" />
              <Link
                href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-lg text-text-secondary hover:text-primary font-medium"
              >
                Sign In
              </Link>
              <Link
                href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-lg bg-primary text-white text-center font-semibold mt-2"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
