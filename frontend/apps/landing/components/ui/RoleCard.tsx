'use client';

import { motion } from 'framer-motion';

interface RoleCardProps {
  icon: React.ReactNode;
  role: string;
  benefits: string[];
  color: string;
  index?: number;
}

export default function RoleCard({ icon, role, benefits, color, index = 0 }: RoleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className="group bg-white rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-xl border border-gray-100 hover:border-primary/20 transition-all duration-300"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white mb-5 text-2xl group-hover:scale-110 transition-transform duration-300"
        style={{ background: color }}
      >
        {icon}
      </div>
      <h3 className="text-xl font-bold text-text mb-4">{role}</h3>
      <ul className="space-y-2.5">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-text-secondary text-sm">
            <svg className="w-4 h-4 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
