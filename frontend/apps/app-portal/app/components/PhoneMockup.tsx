'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Screenshot {
  label: string;
  imageUrl?: string;
  gradient?: string;
  icon?: React.ReactNode;
}

interface PhoneMockupProps {
  screenshots: Screenshot[];
  className?: string;
}

export default function PhoneMockup({ screenshots, className = '' }: PhoneMockupProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % screenshots.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [screenshots.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className={`landing-phone-mockup ${className}`}
    >
      <div className="landing-phone-frame">
        <div className="landing-phone-body">
          <div className="landing-phone-notch" />
          <div className="landing-phone-island" />
          <div className="landing-phone-screen">
            {screenshots.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: i === current ? 1 : 0, scale: i === current ? 1 : 0.95 }}
                transition={{ duration: 0.5 }}
                className="landing-phone-slide"
              >
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    alt={s.label}
                    className="landing-phone-screenshot"
                  />
                ) : (
                  <div
                    className="landing-phone-fallback"
                    style={{ background: s.gradient || 'linear-gradient(135deg, #0F4C81, #00AEEF)' }}
                  >
                    {s.icon && <div className="landing-phone-fallback-icon">{s.icon}</div>}
                    <span className="landing-phone-fallback-label">{s.label}</span>
                    <div className="landing-phone-fallback-bars">
                      <div className="landing-phone-bar" style={{ width: '75%' }} />
                      <div className="landing-phone-bar" style={{ width: '50%' }} />
                      <div className="landing-phone-bar" style={{ width: '83%' }} />
                      <div className="landing-phone-bar" style={{ width: '66%' }} />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <div className="landing-phone-home" />
        </div>
      </div>
    </motion.div>
  );
}
