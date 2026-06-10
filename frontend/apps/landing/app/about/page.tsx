import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Target, Eye, Heart, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Smart Tech SaaS - our mission, vision, and the team behind the modern school management platform.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-gray-900">Smart Tech SaaS</span>
          </Link>
          <Link href="/" className="text-gray-600 hover:text-primary transition-colors">
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">About Us</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We are on a mission to transform school management through innovative technology, making education administration effortless for institutions worldwide.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
          <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
            <p>
              Smart Tech SaaS was born out of a simple observation: school administrators were spending too much time on paperwork and not enough on education. Founded in 2020, our team of educators and technologists set out to build a platform that would automate the mundane and amplify the meaningful.
            </p>
            <p>
              What started as a simple timetable generator quickly evolved into a comprehensive school management ecosystem. Today, Smart Tech SaaS serves over 500 schools across 30 countries, processing millions of data points daily to keep educational institutions running smoothly.
            </p>
            <p>
              We believe that technology should serve education, not complicate it. Every feature we build is designed with input from real teachers, administrators, and parents to ensure it solves real problems.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-xl p-8 border border-gray-200">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h3>
              <p className="text-gray-600 text-lg">
                To empower educational institutions with intuitive, powerful software that simplifies administration, enhances communication, and enables educators to focus on what matters most — teaching and inspiring students.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-gray-200">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <Eye className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h3>
              <p className="text-gray-600 text-lg">
                A world where every school, regardless of size or budget, has access to world-class management tools that drive efficiency, transparency, and educational excellence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Core Values</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">The principles that guide everything we do.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Education First</h3>
              <p className="text-gray-600">Every decision we make starts with one question: how does this benefit learners and educators?</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Simplicity</h3>
              <p className="text-gray-600">Powerful doesn't have to mean complicated. We design for clarity and ease of use.</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Continuous Innovation</h3>
              <p className="text-gray-600">The educational landscape evolves, and so do we. We constantly improve based on feedback and emerging needs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Leadership Team</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Meet the people driving innovation in school management.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { name: "Alex Johnson", role: "CEO & Co-Founder" },
              { name: "Sarah Chen", role: "CTO & Co-Founder" },
              { name: "Michael Okonkwo", role: "VP of Education" },
              { name: "Emily Rodriguez", role: "VP of Engineering" },
            ].map((member) => (
              <div key={member.name} className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-light rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {member.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <h3 className="font-semibold text-gray-900">{member.name}</h3>
                <p className="text-gray-500 text-sm">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Want to Learn More?</h2>
          <p className="text-blue-100 mb-8">Schedule a demo or start your free trial today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Request a Demo
            </Link>
            <a
              href="https://app.smarttechsaas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        &copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.
      </footer>
    </div>
  );
}
