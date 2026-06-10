import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Users, CalendarCheck, ClipboardCheck, MessageSquare, BarChart3, Bot, FileBadge, CheckCircle, ArrowRight, ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Features",
  description: "Explore the comprehensive features of Smart Tech SaaS - student management, smart timetables, assessments, analytics, communications, AI tutor, and certificate management.",
};

const features = [
  {
    icon: Users,
    title: "Student Management",
    description: "Complete student lifecycle management from admission to graduation.",
    details: [
      "Comprehensive student profiles with photos and documents",
      "Attendance tracking with automated notifications",
      "Behavior and discipline record management",
      "Health and medical information tracking",
      "Transport management with route optimization",
      "Student ID card generation",
      "Bulk import and export capabilities",
      "Custom fields for school-specific data",
    ],
  },
  {
    icon: GraduationCap,
    title: "Teacher Portal",
    description: "Empower your teaching staff with dedicated tools and resources.",
    details: [
      "Personalized teacher dashboards",
      "Lesson plan creation and sharing",
      "Grade entry with multiple grading schemes",
      "Attendance marking via web and mobile",
      "Leave and substitute management",
      "Professional development tracking",
      "Classroom resource library",
      "Performance evaluation system",
    ],
  },
  {
    icon: CalendarCheck,
    title: "Smart Timetables",
    description: "AI-powered timetable generator that saves hours of manual work.",
    details: [
      "Automatic timetable generation with conflict resolution",
      "Teacher preference and availability handling",
      "Room and resource allocation optimization",
      "Real-time schedule changes and notifications",
      "Exam timetable creation",
      "Substitute teacher scheduling",
      "Calendar integration (Google, Outlook)",
      "Mobile-friendly schedule views",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Assessment & Results",
    description: "Flexible assessment tools for every grading approach.",
    details: [
      "Custom exam and quiz creation",
      "Multiple grading systems (GPA, percentage, letter, custom)",
      "Automated result computation",
      "Report card generation with school branding",
      "Online result publishing",
      "Parent result portal access",
      "Performance trend analysis",
      "Standards-based grading support",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Data-driven insights to make informed decisions.",
    details: [
      "Real-time school performance dashboards",
      "Attendance trend analysis",
      "Financial reporting and fee tracking",
      "Academic performance analytics",
      "Custom report builder",
      "Export to PDF, Excel, and CSV",
      "Visual data representations",
      "Scheduled automated reports",
    ],
  },
  {
    icon: MessageSquare,
    title: "Communications",
    description: "Keep everyone connected with powerful communication tools.",
    details: [
      "In-app messaging between all stakeholders",
      "Bulk announcements and notifications",
      "Email and SMS integration",
      "Parent-teacher meeting scheduler",
      "Event calendar and reminders",
      "Emergency alert system",
      "Multi-language support",
      "Read receipt and delivery tracking",
    ],
  },
  {
    icon: Bot,
    title: "AI Tutor",
    description: "Artificial intelligence-powered tutoring and support for students.",
    details: [
      "AI-powered homework assistance",
      "Personalized learning recommendations",
      "Automated quiz generation from topics",
      "24/7 student support chatbot",
      "Performance prediction and intervention",
      "Natural language query processing",
      "Integration with curriculum standards",
      "Progress tracking and reports",
    ],
  },
  {
    icon: FileBadge,
    title: "Certificates & Documents",
    description: "Generate and manage official school documents seamlessly.",
    details: [
      "Automated certificate generation",
      "Transcript and report card printing",
      "Digital document verification with QR codes",
      "Bulk document processing",
      "Customizable templates with school branding",
      "Secure document storage and retrieval",
      "Transfer certificate management",
      "E-signature support",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-gray-900">Smart Tech SaaS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className="text-gray-600 hover:text-primary transition-colors">Pricing</Link>
            <Link href="/about" className="text-gray-600 hover:text-primary transition-colors">About</Link>
            <Link href="/contact" className="text-gray-600 hover:text-primary transition-colors">Contact</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Powerful Features for Modern Schools</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From student records to AI-powered tutoring, Smart Tech SaaS provides everything you need to manage your institution efficiently.
          </p>
        </div>
      </section>

      {/* Features List */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-8 lg:p-10">
                    <div className="flex items-start gap-6">
                      <div className="bg-blue-50 w-16 h-16 rounded-xl flex items-center justify-center shrink-0">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h2>
                        <p className="text-lg text-gray-600 mb-6">{feature.description}</p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {feature.details.map((detail) => (
                            <div key={detail} className="flex items-start gap-2">
                              <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                              <span className="text-gray-700">{detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-8">Try Smart Tech SaaS free for 14 days. No credit card required.</p>
          <a
            href="https://app.smarttechsaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Start Free Trial
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
