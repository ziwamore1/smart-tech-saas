'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, BarChart3, BookOpen, Shield, TrendingUp, Bot, ScrollText, Award } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const screenshots = [
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

  return (
    <section className="py-20 lg:py-28 bg-surface">
      <div className="container-main">
        <SectionHeading
          title="See SMART_TECH in Action"
          subtitle="Explore the intuitive interfaces designed for every role in your school."
        />

        <div className="mt-16 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-2">
            {screenshots.map((s, i) => (
              <motion.button
                key={i}
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
                  <div>
                    <div className="font-semibold text-text text-sm">{s.label}</div>
                    <div className="text-xs text-text-secondary">{s.desc}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl p-8 lg:p-12 text-white min-h-[400px] flex flex-col items-center justify-center shadow-xl"
                style={{ background: screenshots[active].gradient }}
              >
                <div className="text-8xl mb-6 opacity-30">
                  {screenshots[active].icon}
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-center">{screenshots[active].label}</h3>
                <p className="text-white/70 text-center mt-3 max-w-md">{screenshots[active].desc}</p>
                <div className="mt-8 flex gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${i < 4 ? 'bg-white/60' : 'bg-white/20'}`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
