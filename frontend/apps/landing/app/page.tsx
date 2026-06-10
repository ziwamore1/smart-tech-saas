import Link from "next/link";
import { GraduationCap, Users, CalendarCheck, ClipboardCheck, MessageSquare, BarChart3, ArrowRight, CheckCircle, Star, ChevronRight, Menu, X } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-gray-900">Smart Tech SaaS</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/features" className="text-gray-600 hover:text-primary transition-colors">Features</Link>
              <Link href="/pricing" className="text-gray-600 hover:text-primary transition-colors">Pricing</Link>
              <Link href="/about" className="text-gray-600 hover:text-primary transition-colors">About</Link>
              <Link href="/contact" className="text-gray-600 hover:text-primary transition-colors">Contact</Link>
            </nav>
            <div className="hidden md:flex items-center gap-4">
              <a
                href="https://app.smarttechsaas.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-primary transition-colors"
              >
                Sign In
              </a>
              <a
                href="https://app.smarttechsaas.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-light transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Star className="h-4 w-4 fill-primary" />
              Trusted by 500+ schools worldwide
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Modern School Management<br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
              Everything you need to manage your educational institution in one place.
              From student records and timetables to assessments and parent communication.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://app.smarttechsaas.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-light transition-colors inline-flex items-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </a>
              <Link
                href="/features"
                className="border-2 border-gray-300 text-gray-700 px-8 py-3.5 rounded-lg font-semibold text-lg hover:border-primary hover:text-primary transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-primary py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">500+</div>
              <div className="text-blue-200 mt-1">Schools</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">50K+</div>
              <div className="text-blue-200 mt-1">Students</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">5K+</div>
              <div className="text-blue-200 mt-1">Teachers</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">99.9%</div>
              <div className="text-blue-200 mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your School
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful tools designed to streamline every aspect of school administration.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Student Management</h3>
              <p className="text-gray-600">
                Comprehensive student profiles with attendance tracking, behavior records, health information, and academic history all in one place.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Teacher Portal</h3>
              <p className="text-gray-600">
                Empower teachers with tools for lesson planning, grade entry, attendance marking, and real-time communication with parents.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <CalendarCheck className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Timetables</h3>
              <p className="text-gray-600">
                AI-powered timetable generator that optimizes schedules, handles conflicts, and respects teacher preferences and room availability.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <ClipboardCheck className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Assessment & Results</h3>
              <p className="text-gray-600">
                Create exams, record marks, generate report cards, and publish results online. Supports GPA, percentage, and custom grading systems.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Communications</h3>
              <p className="text-gray-600">
                Built-in messaging, announcements, and notification system. Keep parents, teachers, and students informed with ease.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Analytics Dashboard</h3>
              <p className="text-gray-600">
                Real-time insights into school performance, attendance trends, financial reports, and student progress with beautiful visualizations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-primary-light py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your School?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of schools already using Smart Tech SaaS to streamline operations and improve educational outcomes.
          </p>
          <a
            href="https://app.smarttechsaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-8 w-8 text-accent" />
                <span className="text-xl font-bold text-white">Smart Tech SaaS</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Modern school management platform designed to simplify administration and enhance educational experiences worldwide.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">Home</Link></li>
                <li><Link href="/features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">Pricing</Link></li>
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">About Us</Link></li>
                <li><Link href="/faq" className="text-gray-400 hover:text-white transition-colors text-sm">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact Us</Link></li>
                <li><Link href="/demo" className="text-gray-400 hover:text-white transition-colors text-sm">Request Demo</Link></li>
                <li><Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>contact@smarttechsaas.com</li>
                <li>+1 (555) 123-4567</li>
                <li>123 Tech Street, Suite 100<br />San Francisco, CA 94105</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
