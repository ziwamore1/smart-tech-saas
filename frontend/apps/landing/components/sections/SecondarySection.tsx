'use client';

import { motion } from 'framer-motion';
import { Layers, ArrowRight, FileCheck, TrendingUp, ScrollText, Award } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const items = [
  { icon: <Layers className="w-5 h-5" />, text: 'Form 1 - Form 6' },
  { icon: <ArrowRight className="w-5 h-5" />, text: 'Grade 10 - 12 Transition' },
  { icon: <FileCheck className="w-5 h-5" />, text: 'ECZ Examination Support' },
  { icon: <TrendingUp className="w-5 h-5" />, text: 'Automated Ranking' },
  { icon: <ScrollText className="w-5 h-5" />, text: 'Report Card Generation' },
];

export default function SecondarySection() {
  return (
    <section className="py-16 lg:py-20 bg-surface">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:order-2"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/5 text-secondary text-sm font-medium mb-6">
              <Award className="w-4 h-4" />
              Secondary Education
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-text mb-4">Advanced Secondary School Management</h3>
            <p className="text-text-secondary leading-relaxed mb-8">
              Purpose-built for secondary schools with comprehensive support for grade transitions, national examinations, and academic ranking.
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
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
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
            className="lg:order-1"
          >
            <div className="bg-gradient-to-br from-secondary to-secondary-dark rounded-3xl p-8 lg:p-12 text-white">
              <TrendingUp className="w-16 h-16 mb-6 opacity-20" />
              <h4 className="text-2xl font-bold mb-4">ECZ Exam Excellence</h4>
              <p className="text-white/80 leading-relaxed">
                Full support for Grade 9 and Grade 12 ECZ examinations, automated ranking, 
        school performance analytics, and seamless report card generation.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
