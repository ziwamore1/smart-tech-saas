'use client';

import { BookOpen, BarChart3, MessageSquare, GraduationCap, Smartphone } from 'lucide-react';
import Button from '@/components/ui/Button';
import TrustIndicator from '@/components/ui/TrustIndicator';
import PhoneMockup from '@/components/ui/PhoneMockup';
import AnimatedBackground from '@/components/ui/AnimatedBackground';

const screenshots = [
  { label: 'Student Dashboard', gradient: 'linear-gradient(135deg, #0F4C81, #00AEEF)', icon: <GraduationCap /> },
  { label: 'Parent Dashboard', gradient: 'linear-gradient(135deg, #00C896, #00AEEF)', icon: <BarChart3 /> },
  { label: 'Teacher Dashboard', gradient: 'linear-gradient(135deg, #0B1220, #0F4C81)', icon: <BookOpen /> },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden gradient-hero">
      <AnimatedBackground />

      <div className="relative z-10 container-main py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-sm mb-8">
              <Smartphone className="w-4 h-4 text-secondary" />
              Trusted by 500+ Schools Across Africa
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight">
              AI-Powered School Management Platform for{' '}
              <span className="gradient-text">Modern Education</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-300 leading-relaxed max-w-lg">
              Manage Students, Teachers, Attendance, Examinations, Results, Communication, AI Learning, and School Operations from a Single Intelligent Platform.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">
              <Button href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.smarttechsaas.com'} variant="secondary" size="lg" external>
                Get Started
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Button>
              <Button href="/demo" variant="outline" size="lg">
                Book a Demo
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-10">
              <TrustIndicator text="Cloud-Based" />
              <TrustIndicator text="Mobile Ready" />
              <TrustIndicator text="AI Powered" />
              <TrustIndicator text="Secure &amp; Scalable" />
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <PhoneMockup screenshots={screenshots} />
          </div>
        </div>
      </div>
    </section>
  );
}
