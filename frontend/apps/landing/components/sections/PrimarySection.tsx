'use client';

import { motion } from 'framer-motion';
import {
  School, ClipboardList, Star, TrendingUp, FileCheck, BookOpen,
  Baby, Brain, GitBranch, GraduationCap, BarChart3, ScrollText,
  Award, CheckSquare,
} from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const coreFeatures = [
  { icon: <School className="w-5 h-5" />, text: 'Primary School Management (Gr 1-7)' },
  { icon: <Baby className="w-5 h-5" />, text: 'Early Childhood Education (ECE)' },
  { icon: <ClipboardList className="w-5 h-5" />, text: 'Continuous Assessment Tracking' },
  { icon: <TrendingUp className="w-5 h-5" />, text: 'Competency-Based Curriculum (CBC)' },
  { icon: <Star className="w-5 h-5" />, text: 'Performance & Benchmarking Analytics' },
  { icon: <FileCheck className="w-5 h-5" />, text: 'Automated Report Cards' },
];

const grade7Features = [
  { icon: <GraduationCap className="w-5 h-5" />, text: 'Grade 7 ECZ Computation Engine' },
  { icon: <BarChart3 className="w-5 h-5" />, text: 'Subject Conversion Rules (50-150 scale)' },
  { icon: <GitBranch className="w-5 h-5" />, text: 'Best 4 Subject Selection (incl. English + Math)' },
  { icon: <Award className="w-5 h-5" />, text: 'Division Classification (1-4) with Colors' },
  { icon: <ScrollText className="w-5 h-5" />, text: 'Special Papers (SP1, SP2) Handling' },
  { icon: <CheckSquare className="w-5 h-5" />, text: 'Batch Processing & School Ranking' },
];

const curriculumFeatures = [
  { icon: <Brain className="w-5 h-5" />, text: 'AI-Powered Topic & Competency Mapping' },
  { icon: <BookOpen className="w-5 h-5" />, text: 'School-Based Assessment (SBA) Management' },
  { icon: <BarChart3 className="w-5 h-5" />, text: 'Curriculum Coverage & Compliance Analytics' },
  { icon: <GraduationCap className="w-5 h-5" />, text: 'Promotion & Pathway Rules Engine' },
];

export default function PrimarySection() {
  return (
    <section className="py-16 lg:py-20 bg-white" id="primary">
      <div className="container-main">
        <SectionHeading
          title="Primary School — Complete Ecosystem"
          subtitle="From ECE through Grade 7, including the new Competency-Based Curriculum and full ECZ Grade 7 examination processing."
        />

        <div className="mt-16 space-y-20">
          {/* Core Management */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-medium mb-6">
              <School className="w-4 h-4" />
              Core School Management
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {coreFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-gray-100 hover:border-primary/20 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium text-text text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Grade 7 ECZ Engine */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/5 text-accent text-sm font-medium mb-6">
              <GraduationCap className="w-4 h-4" />
              Grade 7 ECZ Examination Engine
            </div>
            <div className="gradient-primary rounded-3xl p-8 lg:p-12 text-white mb-8">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h4 className="text-2xl font-bold mb-4">Automated Grade 7 Processing</h4>
                  <p className="text-white/80 leading-relaxed">
                    Our Grade 7 ECZ engine handles the full examination lifecycle — from raw score conversion 
                    using Zambian standardized rules (50-150 scale), through best-subject selection, 
                    division classification, to final certificate generation. Batch process entire classes 
                    and generate school rankings automatically.
                  </p>
                </div>
                <div className="space-y-3">
                  {grade7Features.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
                      <div className="text-white/80">{item.icon}</div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* New Curriculum & CIE */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/5 text-purple-500 text-sm font-medium mb-6">
              <Brain className="w-4 h-4" />
              New Curriculum — Competency-Based Education (CBE)
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {curriculumFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="p-5 rounded-xl bg-white border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                    {item.icon}
                  </div>
                  <span className="font-medium text-text text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 p-6 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-text-secondary text-sm leading-relaxed">
                <strong className="text-purple-700">New:</strong> Full Competency-Based Curriculum support including 
                AI-powered topic/subtopic/competency mapping, curriculum compliance analytics, 
                School-Based Assessment (SBA) task management with templates, AI lesson plan generation, 
                and smart promotion/pathway rules for STEM and Trade/Vocational tracks.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
