'use client';

import { motion } from 'framer-motion';

interface TrustIndicatorProps {
  text: string;
  className?: string;
}

export default function TrustIndicator({ text, className = '' }: TrustIndicatorProps) {
  return (
    <motion.span
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className={`inline-flex items-center gap-2 text-sm font-medium text-gray-300 ${className}`}
    >
      <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      {text}
    </motion.span>
  );
}
