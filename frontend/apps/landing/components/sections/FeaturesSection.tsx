'use client';

import {
  CalendarCheck, FileCheck, ScrollText, Bot, Users2, UserCog,
  MessageCircle, BadgeCheck, LineChart, TrendingUp, Clock, Smartphone,
} from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import FeatureCard from '@/components/ui/FeatureCard';

const features = [
  { icon: <CalendarCheck className="w-6 h-6" />, title: 'Attendance Management', description: 'Track student and staff attendance in real-time with biometric, QR code, and manual entry options. Generate instant reports.' },
  { icon: <FileCheck className="w-6 h-6" />, title: 'Examination Management', description: 'Create, schedule, and grade examinations. Support for continuous assessment, term exams, and national exam preparation.' },
  { icon: <ScrollText className="w-6 h-6" />, title: 'Automated Report Cards', description: 'Generate professional report cards automatically with grades, comments, rankings, and performance analytics.' },
  { icon: <Bot className="w-6 h-6" />, title: 'AI Tutor', description: '24/7 AI-powered learning assistant that helps students with homework, exam preparation, and personalized learning paths.' },
  { icon: <Users2 className="w-6 h-6" />, title: 'Parent Engagement', description: 'Keep parents informed with real-time updates on attendance, grades, assignments, and school communications.' },
  { icon: <UserCog className="w-6 h-6" />, title: 'Teacher Management', description: 'Manage teacher profiles, assignments, timetables, performance reviews, and professional development.' },
  { icon: <MessageCircle className="w-6 h-6" />, title: 'School Communication', description: 'Send announcements, alerts, and messages to parents, teachers, and students via SMS, email, and in-app notifications.' },
  { icon: <BadgeCheck className="w-6 h-6" />, title: 'Digital Certificates', description: 'Create and issue verifiable digital certificates with blockchain-ready signatures and QR code verification.' },
  { icon: <LineChart className="w-6 h-6" />, title: 'Student Analytics', description: 'Comprehensive analytics on student performance, attendance trends, behavioral patterns, and academic progress.' },
  { icon: <TrendingUp className="w-6 h-6" />, title: 'Learning Progress', description: 'Track individual student learning journeys with detailed progress reports and competency-based assessments.' },
  { icon: <Clock className="w-6 h-6" />, title: 'Timetable Management', description: 'AI-powered timetable generator that optimizes schedules, room assignments, and resource allocation.' },
  { icon: <Smartphone className="w-6 h-6" />, title: 'Mobile Application', description: 'Full-featured mobile app for Android and iOS. Access grades, attendance, communication, and AI tutor on the go.' },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-surface">
      <div className="container-main">
        <SectionHeading
          title="Everything You Need to Run Your School"
          subtitle="A complete ecosystem of tools designed to streamline every aspect of school management, from attendance to analytics."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-16">
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} description={f.description} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
