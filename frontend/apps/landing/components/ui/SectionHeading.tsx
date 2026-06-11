'use client';

import { motion } from 'framer-motion';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
  className?: string;
}

export default function SectionHeading({ title, subtitle, centered = true, light = false, className = '' }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''} ${className}`}
    >
      <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight ${light ? 'text-white' : 'text-text'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-lg md:text-xl leading-relaxed ${light ? 'text-gray-300' : 'text-text-secondary'}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
