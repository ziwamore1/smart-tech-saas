'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const comparisons = [
  { traditional: 'Manual Paper-Based Processes', smart: 'Fully Automated Digital System' },
  { traditional: 'Paper Report Cards', smart: 'Digital Report Cards with Analytics' },
  { traditional: 'Delayed Parent Communication', smart: 'Real-Time Instant Notifications' },
  { traditional: 'Manual Timetable Creation', smart: 'AI-Powered Timetable Generator' },
  { traditional: 'Physical File Storage', smart: 'Secure Cloud-Based Storage' },
  { traditional: 'Limited Student Analytics', smart: 'Comprehensive AI-Driven Insights' },
  { traditional: 'Single-School Focus', smart: 'Multi-School Management Support' },
];

export default function WhySection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container-main">
        <SectionHeading
          title="Why SMART_TECH?"
          subtitle="See how we transform traditional school management into a modern, efficient, and intelligent experience."
        />

        <div className="max-w-4xl mx-auto mt-16">
          {comparisons.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.08 }}
              className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center py-4 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3 justify-end">
                <span className="text-text-secondary text-sm md:text-base text-right">{c.traditional}</span>
                <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4 text-red-500" />
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-accent" />
              </div>

              <div className="flex items-center gap-3">
                <span className="font-semibold text-text text-sm md:text-base">{c.smart}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
