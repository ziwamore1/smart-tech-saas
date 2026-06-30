'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, BarChart3, BookOpen, Shield, TrendingUp, Bot, ScrollText, Award,
} from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.smarttechsaas.com/api/v1').replace(/\/+$/, '');
const API_URL = API_BASE.includes('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;
const PUBLIC_MOCKUPS_URL = `${API_URL}/public/landing-mockups`;

interface MockupImage { id: string; label: string; role: string; category: string; imageUrl: string; thumbnailUrl?: string; }

async function fetchMockups(): Promise<MockupImage[]> {
  try {
    const res = await fetch(PUBLIC_MOCKUPS_URL);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

const fallbackScreenshots = [
  { label: 'Student Dashboard', gradient: 'linear-gradient(135deg, #0F4C81, #00AEEF)', icon: <GraduationCap className="w-8 h-8" />, desc: 'View grades, attendance, timetable, and assignments' },
  { label: 'Parent Dashboard', gradient: 'linear-gradient(135deg, #00C896, #00AEEF)', icon: <BarChart3 className="w-8 h-8" />, desc: 'Monitor child progress and school communications' },
  { label: 'Teacher Dashboard', gradient: 'linear-gradient(135deg, #0B1220, #0F4C81)', icon: <BookOpen className="w-8 h-8" />, desc: 'Manage classes, grades, and attendance records' },
  { label: 'Director Dashboard', gradient: 'linear-gradient(135deg, #6B21A8, #0F4C81)', icon: <Shield className="w-8 h-8" />, desc: 'School-wide analytics and performance reports' },
  { label: 'Analytics', gradient: 'linear-gradient(135deg, #DC2626, #6B21A8)', icon: <TrendingUp className="w-8 h-8" />, desc: 'Comprehensive data insights and trends' },
  { label: 'AI Tutor', gradient: 'linear-gradient(135deg, #00AEEF, #00C896)', icon: <Bot className="w-8 h-8" />, desc: '24/7 intelligent learning assistant' },
  { label: 'Report Cards', gradient: 'linear-gradient(135deg, #0F4C81, #0B1220)', icon: <ScrollText className="w-8 h-8" />, desc: 'Automated professional report generation' },
  { label: 'Certificates', gradient: 'linear-gradient(135deg, #00C896, #0F4C81)', icon: <Award className="w-8 h-8" />, desc: 'Digital certificates with QR verification' },
];

export default function GallerySection() {
  const [active, setActive] = useState(0);
  const [mockups, setMockups] = useState<MockupImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMockups().then((data) => {
      setMockups(data);
      setLoading(false);
    });
  }, []);

  const hasRealImages = mockups.length > 0;

  const displayItems = hasRealImages
    ? mockups.map((m) => ({
        id: m.id,
        label: m.label,
        gradient: 'linear-gradient(135deg, #0F4C81, #00AEEF)',
        icon: <GraduationCap className="w-8 h-8" />,
        imageUrl: m.imageUrl,
        desc: `${m.role} — ${m.category}`,
      }))
    : fallbackScreenshots.map((s, i) => ({
        id: String(i),
        ...s,
        imageUrl: undefined,
      }));

  const current = displayItems[active] || displayItems[0];

  return (
    <section className="py-20 lg:py-28 bg-white" id="gallery">
      <div className="container-main">
        <SectionHeading
          title="See SMART_TECH in Action"
          subtitle={hasRealImages ? 'Real screenshots from the live mobile app. Uploaded by our team.' : 'Explore the intuitive interfaces designed for every role in your school.'}
        />

        <div className="mt-16 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-2">
            {displayItems.map((s, i) => (
              <motion.button
                key={s.id}
                onClick={() => setActive(i)}
                whileHover={{ x: 4 }}
                className={`w-full text-left p-4 rounded-xl transition-all duration-300 border ${
                  active === i
                    ? 'bg-white border-primary/20 shadow-md'
                    : 'bg-transparent border-transparent hover:bg-white/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ background: s.gradient }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text text-sm truncate">{s.label}</div>
                    <div className="text-xs text-text-secondary truncate">
                      {s.imageUrl ? `${(s as any).desc || s.label}` : (s as any).desc}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
            {loading && (
              <div className="text-center py-4 text-text-secondary text-sm">Loading screenshots...</div>
            )}
          </div>

          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl min-h-[400px] flex flex-col items-center justify-center shadow-xl overflow-hidden"
              >
                {current.imageUrl ? (
                  <div className="relative w-full h-[500px]">
                    <img
                      src={current.imageUrl}
                      alt={current.label}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="w-full h-full p-8 lg:p-12 text-white flex flex-col items-center justify-center"
                    style={{ background: current.gradient, minHeight: '400px' }}
                  >
                    <div className="text-8xl mb-6 opacity-30">{current.icon}</div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-center">{current.label}</h3>
                    <p className="text-white/70 text-center mt-3 max-w-md">{(current as any).desc}</p>
                    <div className="mt-8 flex gap-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i < 4 ? 'bg-white/60' : 'bg-white/20'}`} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
