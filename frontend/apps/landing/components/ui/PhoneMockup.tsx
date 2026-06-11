'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface PhoneMockupProps {
  screenshots: { label: string; gradient: string; icon: React.ReactNode }[];
  className?: string;
}

export default function PhoneMockup({ screenshots, className = '' }: PhoneMockupProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % screenshots.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [screenshots.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
      animate={{ y: [0, -12, 0] }}
      transition={{ y: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
      className={`relative mx-auto ${className}`}
    >
      <div className="relative w-[280px] h-[580px] mx-auto">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 rounded-[3rem] shadow-2xl border-4 border-gray-700">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-600 rounded-full z-20" />
          <div className="absolute inset-[6px] top-8 bottom-8 bg-white rounded-[2.5rem] overflow-hidden">
            {screenshots.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: i === current ? 1 : 0, scale: i === current ? 1 : 0.95 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6"
                style={{ background: s.gradient }}
              >
                <div className="text-6xl mb-4">{s.icon}</div>
                <span className="text-white font-semibold text-lg text-center">{s.label}</span>
                <div className="mt-6 w-full space-y-2">
                  <div className="h-2 bg-white/20 rounded-full w-3/4 mx-auto" />
                  <div className="h-2 bg-white/20 rounded-full w-1/2 mx-auto" />
                  <div className="h-2 bg-white/20 rounded-full w-5/6 mx-auto" />
                  <div className="h-2 bg-white/20 rounded-full w-2/3 mx-auto" />
                </div>
              </motion.div>
            ))}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 border-2 border-gray-600 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}
