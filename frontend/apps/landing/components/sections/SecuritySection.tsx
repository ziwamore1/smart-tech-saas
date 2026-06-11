'use client';

import { motion } from 'framer-motion';
import { Shield, Lock, Users, PenSquare, QrCode, Database } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const features = [
  { icon: <Shield className="w-5 h-5" />, title: 'Cloud Security', description: 'Enterprise-grade cloud infrastructure with 99.9% uptime guarantee.' },
  { icon: <Lock className="w-5 h-5" />, title: 'Encrypted Data', description: 'All data encrypted at rest and in transit using industry-standard protocols.' },
  { icon: <Users className="w-5 h-5" />, title: 'Role-Based Access', description: 'Granular permission controls for every user role in your institution.' },
  { icon: <PenSquare className="w-5 h-5" />, title: 'Digital Signatures', description: 'Secure digital signatures for certificates, report cards, and official documents.' },
  { icon: <QrCode className="w-5 h-5" />, title: 'Certificate Verification', description: 'Instant QR code verification for all issued certificates and documents.' },
  { icon: <Database className="w-5 h-5" />, title: 'Data Backups', description: 'Automated daily backups with point-in-time recovery capabilities.' },
];

export default function SecuritySection() {
  return (
    <section className="py-20 lg:py-28 gradient-dark text-white">
      <div className="container-main">
        <SectionHeading
          light
          title="Enterprise-Grade Security"
          subtitle="Your data is protected with the highest standards of security and compliance."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-secondary mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
