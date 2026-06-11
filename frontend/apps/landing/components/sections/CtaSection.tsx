'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Play, PhoneCall } from 'lucide-react';
import Button from '@/components/ui/Button';
import SectionHeading from '@/components/ui/SectionHeading';

export default function CtaSection() {
  return (
    <section className="py-20 lg:py-28 bg-white relative overflow-hidden">
      <div className="absolute inset-0 gradient-primary opacity-5 pointer-events-none" />
      <div className="container-main relative">
        <SectionHeading
          title="Ready to Transform Your School?"
          subtitle="Join 500+ schools already using SMART_TECH to modernize their education management."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4 mt-10"
        >
          <Button href="/demo" variant="primary" size="lg">
            Request Demo
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'} variant="secondary" size="lg" external>
            Start Free Trial
            <Play className="w-5 h-5" />
          </Button>
          <Button href="/contact" variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/5">
            <PhoneCall className="w-5 h-5" />
            Contact Sales
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
