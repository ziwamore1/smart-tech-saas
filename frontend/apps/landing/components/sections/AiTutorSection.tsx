'use client';

import { motion } from 'framer-motion';
import { Bot, Calculator, Beaker, BookOpen, GraduationCap, Sparkles } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const highlights = [
  { icon: <Calculator className="w-5 h-5" />, text: 'Mathematics Support' },
  { icon: <Beaker className="w-5 h-5" />, text: 'Science Assistance' },
  { icon: <BookOpen className="w-5 h-5" />, text: 'Homework Help' },
  { icon: <GraduationCap className="w-5 h-5" />, text: 'Exam Preparation' },
  { icon: <Sparkles className="w-5 h-5" />, text: 'Personalized Learning' },
];

export default function AiTutorSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container-main">
        <SectionHeading
          title="Meet Your 24/7 AI Learning Assistant"
          subtitle="An intelligent tutor that adapts to each student's learning pace, provides instant feedback, and makes learning engaging and effective."
        />

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="bg-surface rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">
                  S
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-xs">
                  <p className="text-text text-sm">Can you help me solve this quadratic equation? 2x² + 5x - 3 = 0</p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="gradient-primary rounded-2xl rounded-tl-none px-4 py-3 max-w-sm">
                  <p className="text-white text-sm leading-relaxed">
                    Let&apos;s solve this step by step! This is a quadratic equation in the form ax² + bx + c = 0.
                    Here, a=2, b=5, c=-3. Using the quadratic formula x = (-b ± √(b² - 4ac)) / 2a...
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="mt-4 flex items-center gap-2 text-xs text-text-secondary ml-14"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                AI Tutor is typing...
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-text mb-6">Intelligent Learning Support</h3>
            <div className="space-y-3">
              {highlights.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-primary/5 transition-colors border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {h.icon}
                  </div>
                  <span className="font-medium text-text">{h.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
