import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, CalendarCheck, ArrowRight, CheckCircle, Send } from "lucide-react";

export const metadata: Metadata = {
  title: "Request a Demo",
  description: "Schedule a personalized demo of Smart Tech SaaS for your school. See how our platform can transform your school management.",
};

export default function DemoPage() {
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Request a Personalized Demo</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See Smart Tech SaaS in action. Our team will walk you through the platform tailored to your school's needs.
          </p>
        </div>
      </section>

      {/* Demo Form */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Fill Out the Form</h2>
              <p className="text-gray-600 mb-8">
                Provide your details and our team will reach out within 24 hours to schedule your personalized demo.
              </p>
              <div className="space-y-4">
                {[
                  "Personalized walkthrough of relevant features",
                  "Q&A session with our product specialists",
                  "Customized pricing and implementation timeline",
                  "Free 14-day trial access after the demo",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <form className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      id="firstName"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      id="lastName"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                    placeholder="john@school.edu"
                  />
                </div>
                <div>
                  <label htmlFor="school" className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                  <input
                    type="text"
                    id="school"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                    placeholder="Springfield Elementary School"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <textarea
                    id="message"
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors resize-none"
                    placeholder="Tell us about your school, current system, and what you are looking for..."
                  />
                </div>
                <button
                  type="button"
                  className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors inline-flex items-center justify-center gap-2"
                >
                  Request Demo
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.</p>
      </footer>
    </div>
  );
}
