'use client';

import { motion } from 'framer-motion';
import {
  Layers, ArrowRight, FileCheck, TrendingUp, ScrollText, Award,
  BarChart3, GitBranch, Bot, BookOpen, LineChart, Users,
} from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';

const coreFeatures = [
  { icon: <Layers className="w-5 h-5" />, text: 'Form 1 — Form 6 Full Support' },
  { icon: <ArrowRight className="w-5 h-5" />, text: 'Grade 10 — 12 Transition Management' },
  { icon: <FileCheck className="w-5 h-5" />, text: 'ECZ Grade 9 & Grade 12 Examination Support' },
  { icon: <TrendingUp className="w-5 h-5" />, text: 'Automated School & Student Ranking' },
  { icon: <ScrollText className="w-5 h-5" />, text: 'Professional Report Card Generation' },
  { icon: <Users className="w-5 h-5" />, text: 'Parent Engagement & Communication' },
];

const advancedFeatures = [
  { icon: <BarChart3 className="w-5 h-5" />, text: 'Selection Analytics — Predicted Schools & Cutoffs' },
  { icon: <GitBranch className="w-5 h-5" />, text: 'Subject Pathway Rules (STEM, Trade/Vocational)' },
  { icon: <LineChart className="w-5 h-5" />, text: 'District & Province Performance Rankings' },
  { icon: <Award className="w-5 h-5" />, text: 'Certification Rules Engine (min subjects, passes)' },
];

const newFeatures = [
  { icon: <Bot className="w-5 h-5" />, text: 'AI-Powered Exam Paper Generation' },
  { icon: <BookOpen className="w-5 h-5" />, text: 'AI Lesson Planning from Curriculum Topics' },
  { icon: <BarChart3 className="w-5 h-5" />, text: 'Curriculum Compliance & Coverage Analytics' },
  { icon: <GitBranch className="w-5 h-5" />, text: 'Competency-Based Education (CBE) Transition' },
];

export default function SecondarySection() {
  return (
    <section className="py-16 lg:py-20 bg-surface" id="secondary">
      <div className="container-main">
        <SectionHeading
          title="Secondary School — Advanced Academic Management"
          subtitle="Comprehensive support for Form 1-6, ECZ Grade 9 & 12, selection analytics, and the new Competency-Based curriculum transition."
        />

        <div className="mt-16 space-y-20">
          {/* Core Management */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/5 text-secondary text-sm font-medium mb-6">
              <Layers className="w-4 h-4" />
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
                  className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-secondary/20 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium text-text text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Advanced Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/5 text-secondary text-sm font-medium mb-6">
                <BarChart3 className="w-4 h-4" />
                Selection Analytics & Rankings
              </div>
              <p className="text-text-secondary leading-relaxed mb-6">
                Make data-driven decisions with our advanced selection analytics engine. 
                Predict student placement into secondary schools using historical cutoff data, 
                analyze district and province-level performance trends, and manage subject 
                pathway rules for STEM and Trade/Vocational tracks.
              </p>
              <div className="space-y-3">
                {advancedFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <span className="font-medium text-text text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary to-secondary-dark rounded-3xl p-8 lg:p-12 text-white mt-8 lg:mt-0">
              <TrendingUp className="w-16 h-16 mb-6 opacity-20" />
              <h4 className="text-2xl font-bold mb-4">ECZ Exam Excellence</h4>
              <p className="text-white/80 leading-relaxed">
                Full support for Grade 9 and Grade 12 ECZ examinations, automated ranking, 
                school performance analytics, and seamless report card generation.
              </p>
            </div>
          </motion.div>

          {/* New Curriculum */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/5 text-purple-500 text-sm font-medium mb-6">
              <Bot className="w-4 h-4" />
              New — AI-Powered Curriculum Intelligence
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {newFeatures.map((item, i) => (
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
                <strong className="text-purple-700">New:</strong> Our Curriculum Intelligence Engine (CIE) uses AI 
                to generate exam papers from curriculum topics, create lesson plans aligned to the Zambian syllabus, 
                track curriculum coverage in real-time, and support the transition to Competency-Based Education (CBE). 
                Includes full Zambian 2024 Primary, 2025 Secondary Transitional, and Future Secondary curriculum versions.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
