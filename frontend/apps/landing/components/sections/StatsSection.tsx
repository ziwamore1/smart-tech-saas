'use client';

import { motion } from 'framer-motion';
import { BookOpen, Users, School, FileText, ClipboardCheck, Trophy } from 'lucide-react';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const stats = [
  { end: 500, suffix: '+', label: 'Schools Managed', icon: <School className="w-6 h-6" /> },
  { end: 50000, suffix: '+', label: 'Students Supported', icon: <Users className="w-6 h-6" /> },
  { end: 100000, suffix: '+', label: 'Reports Generated', icon: <FileText className="w-6 h-6" /> },
  { end: 500000, suffix: '+', label: 'Assignments Submitted', icon: <ClipboardCheck className="w-6 h-6" /> },
  { end: 2000000, suffix: '+', label: 'Attendance Records', icon: <BookOpen className="w-6 h-6" /> },
  { end: 50000, suffix: '+', label: 'Certificates Issued', icon: <Trophy className="w-6 h-6" /> },
];

export default function StatsSection() {
  return (
    <section className="py-16 lg:py-20 bg-white border-b border-gray-100">
      <div className="container-main">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mx-auto mb-3">
                {stat.icon}
              </div>
              <AnimatedCounter end={stat.end} suffix={stat.suffix} label={stat.label} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
