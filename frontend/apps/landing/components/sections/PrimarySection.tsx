'use client';

import { motion } from 'framer-motion';
import { School, ClipboardList, Star, TrendingUp, FileCheck, BookOpen } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const items = [
  { icon: <School className="w-5 h-5" />, text: 'Primary School Management' },
  { icon: <ClipboardList className="w-5 h-5" />, text: 'Grade 7 ECZ Support' },
  { icon: <Star className="w-5 h-5" />, text: 'Continuous Assessment' },
  { icon: <TrendingUp className="w-5 h-5" />, text: 'Performance Tracking' },
  { icon: <FileCheck className="w-5 h-5" />, text: 'ECZ Examination Processing' },
];

export default function PrimarySection() {
  return (
    <section className="py-16 lg:py-20 bg-white">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-medium mb-6">
              <School className="w-4 h-4" />
              Primary Education
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-text mb-4">Complete Primary School Support</h3>
            <p className="text-text-secondary leading-relaxed mb-8">
              Built specifically for primary schools with features designed to support young learners, teachers, and the unique requirements of primary education.
            </p>
            <div className="space-y-3">
              {items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium text-text">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="gradient-primary rounded-3xl p-8 lg:p-12 text-white">
              <BookOpen className="w-16 h-16 mb-6 opacity-20" />
              <h4 className="text-2xl font-bold mb-4">Grade 7 ECZ Preparation</h4>
              <p className="text-white/80 leading-relaxed">
                Comprehensive support for Grade 7 ECZ examinations including past paper management, 
        performance tracking, and automated results processing.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
