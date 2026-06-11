'use client';

import { motion } from 'framer-motion';
import { Smartphone, CheckCircle, MessageCircle, Bell, BookOpen, ClipboardList, Home, Users } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const highlights = [
  { icon: <CheckCircle className="w-5 h-5" />, text: 'Attendance Tracking' },
  { icon: <ClipboardList className="w-5 h-5" />, text: 'Results & Grades' },
  { icon: <BookOpen className="w-5 h-5" />, text: 'AI Tutor Access' },
  { icon: <MessageCircle className="w-5 h-5" />, text: 'Instant Messaging' },
  { icon: <Bell className="w-5 h-5" />, text: 'Push Notifications' },
  { icon: <Home className="w-5 h-5" />, text: 'Homework & Assignments' },
  { icon: <Users className="w-5 h-5" />, text: 'Parent Portal' },
];

export default function MobileAppSection() {
  return (
    <section className="py-20 lg:py-28 bg-white overflow-hidden">
      <div className="container-main">
        <SectionHeading
          title="Your School in Your Pocket"
          subtitle="Full-featured mobile applications for Android and iOS. Stay connected, informed, and productive on the go."
        />

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="relative w-[260px]">
              <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2.5rem] p-3 shadow-2xl border-4 border-gray-700">
                <div className="bg-white rounded-[2rem] overflow-hidden">
                  <div className="bg-primary p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-6 h-6 bg-white/20 rounded-full" />
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-white text-xs">
                        <span>Today&apos;s Classes</span>
                        <span>3 remaining</span>
                      </div>
                      {['Mathematics 8A', 'English 8B', 'Science 8A'].map((cls, i) => (
                        <div key={i} className="bg-white/10 rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-white text-xs font-medium">{cls}</span>
                          <span className="text-white/60 text-[10px]">Room {201 + i}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-text">Attendance</span>
                      <span className="text-xs text-accent">95%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="w-[95%] h-full bg-accent rounded-full" />
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-[10px] text-text-secondary">Next Assignment Due</div>
                      <div className="text-xs font-medium text-text mt-1">Algebra Homework - Tomorrow</div>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                animate={{ rotate: -6, y: [0, -8, 0] }}
                transition={{ y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
                className="absolute -right-16 -bottom-8 w-[200px]"
              >
                <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2rem] p-2.5 shadow-xl border-4 border-gray-700">
                  <div className="bg-gradient-to-br from-secondary to-secondary-dark rounded-[1.5rem] p-4 text-white">
                    <Smartphone className="w-4 h-4 mb-3" />
                    <div className="text-[10px] font-semibold">Parent Portal</div>
                    <div className="text-[8px] text-white/70 mt-1">Stay connected</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-2xl lg:text-3xl font-bold text-text mb-6">
              Everything at Your Fingertips
            </h3>
            <p className="text-text-secondary leading-relaxed mb-8">
              Our mobile app brings the full power of SMART_TECH to your pocket. 
              Students, parents, and teachers can access all features from anywhere.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {highlights.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-gray-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0">
                    {h.icon}
                  </div>
                  <span className="text-sm font-medium text-text">{h.text}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                <Smartphone className="w-4 h-4" />
                Google Play
              </div>
              <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                <Smartphone className="w-4 h-4" />
                App Store
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
