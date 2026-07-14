'use client';

import { useEffect, useState } from 'react';

interface Screenshot {
  label: string;
  imageUrl?: string;
  gradient?: string;
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
    <div className={`landing-phone-mockup ${className}`}>
      <div className="landing-phone-frame">
        <div className="landing-phone-body">
          <div className="landing-phone-notch" />
          <div className="landing-phone-island" />
          <div className="landing-phone-screen">
            {screenshots.map((s, i) => (
              <div
                key={i}
                className={`landing-phone-slide${i === current ? ' active' : ''}`}
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
                    <span className="landing-phone-fallback-label">{s.label}</span>
                    <div className="landing-phone-fallback-bars">
                      <div className="landing-phone-bar" style={{ width: '75%' }} />
                      <div className="landing-phone-bar" style={{ width: '50%' }} />
                      <div className="landing-phone-bar" style={{ width: '83%' }} />
                      <div className="landing-phone-bar" style={{ width: '66%' }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="landing-phone-home" />
        </div>
      </div>
    </div>
  );
}
