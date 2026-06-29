'use client';

import {
  CalendarCheck, FileCheck, ScrollText, Bot, Users2, UserCog,
  MessageCircle, BadgeCheck, LineChart, TrendingUp, Clock, Smartphone,
  Brain, GraduationCap, GitBranch, Baby, BookOpen, BarChart3,
} from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import FeatureCard from '@/components/ui/FeatureCard';

const features = [
  { icon: <CalendarCheck className="w-6 h-6" />, title: 'Attendance Management', description: 'Track student and staff attendance in real-time with biometric, QR code, and manual entry options. Generate instant reports.' },
  { icon: <FileCheck className="w-6 h-6" />, title: 'Examination Management', description: 'Create, schedule, and grade examinations. Support for continuous assessment, term exams, and national exam preparation.' },
  { icon: <ScrollText className="w-6 h-6" />, title: 'Automated Report Cards', description: 'Generate professional report cards automatically with grades, comments, rankings, and performance analytics.' },
  { icon: <Brain className="w-6 h-6" />, title: 'Competency-Based Curriculum', description: 'Full CBE support with topic/competency mapping, curriculum compliance analytics, and AI-powered lesson planning.' },
  { icon: <GraduationCap className="w-6 h-6" />, title: 'Grade 7 ECZ Engine', description: 'Automated Grade 7 examination processing with raw score conversion, best-subject selection, and division classification.' },
  { icon: <GitBranch className="w-6 h-6" />, title: 'Selection Analytics', description: 'Predict student placement into secondary schools, district rankings, and subject pathway management for STEM/Trade.' },
  { icon: <Bot className="w-6 h-6" />, title: 'AI Tutor', description: '24/7 AI-powered learning assistant that helps students with homework, exam preparation, and personalized learning paths.' },
  { icon: <Bot className="w-6 h-6" />, title: 'AI Exam Generator', description: 'Generate exam papers and marking schemes automatically from curriculum topics using AI.' },
  { icon: <Users2 className="w-6 h-6" />, title: 'Parent Engagement', description: 'Keep parents informed with real-time updates on attendance, grades, assignments, and school communications.' },
  { icon: <UserCog className="w-6 h-6" />, title: 'Teacher Management', description: 'Manage teacher profiles, assignments, timetables, performance reviews, and professional development.' },
  { icon: <MessageCircle className="w-6 h-6" />, title: 'School Communication', description: 'Send announcements, alerts, and messages to parents, teachers, and students via SMS, email, and in-app notifications.' },
  { icon: <BadgeCheck className="w-6 h-6" />, title: 'Digital Certificates', description: 'Create and issue verifiable digital certificates with blockchain-ready signatures and QR code verification.' },
  { icon: <LineChart className="w-6 h-6" />, title: 'Student Analytics', description: 'Comprehensive analytics on student performance, attendance trends, behavioral patterns, and academic progress.' },
  { icon: <TrendingUp className="w-6 h-6" />, title: 'School Benchmarking', description: 'Compare performance across classes, grades, and schools with standardized metrics and benchmarking tools.' },
  { icon: <Baby className="w-6 h-6" />, title: 'Early Childhood Education', description: 'Specialized ECE module with age-appropriate assessments, developmental tracking, and play-based curriculum support.' },
  { icon: <BookOpen className="w-6 h-6" />, title: 'School-Based Assessment', description: 'SBA task management with templates, AI scoring, curriculum alignment tracking, and student progress portfolios.' },
  { icon: <BarChart3 className="w-6 h-6" />, title: 'Curriculum Compliance', description: 'Real-time curriculum coverage analytics, gap detection, and compliance reporting against national standards.' },
  { icon: <Smartphone className="w-6 h-6" />, title: 'Mobile Application', description: 'Full-featured mobile app for Android and iOS. Access grades, attendance, communication, and AI tutor on the go.' },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-surface">
      <div className="container-main">
        <SectionHeading
          title="Everything You Need to Run Your School"
          subtitle="A complete ecosystem of tools designed to streamline every aspect of school management, from attendance to analytics. Now with full Competency-Based Curriculum support."
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
