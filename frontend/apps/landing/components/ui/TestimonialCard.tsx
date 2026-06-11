'use client';

import { motion } from 'framer-motion';

interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  school: string;
  initials: string;
  color: string;
  index?: number;
}

export default function TestimonialCard({ quote, name, role, school, initials, color, index = 0 }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100 relative"
    >
      <svg className="w-8 h-8 mb-4 opacity-20" style={{ color }} fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <p className="text-text-secondary leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ background: color }}
        >
          {initials}
        </div>
        <div>
          <div className="font-semibold text-text text-sm">{name}</div>
          <div className="text-text-secondary text-xs">{role}, {school}</div>
        </div>
      </div>
    </motion.div>
  );
}
