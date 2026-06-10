import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, ChevronDown, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Smart Tech SaaS school management platform. Find answers about features, pricing, setup, and support.",
};

const faqs = [
  {
    question: "What is Smart Tech SaaS?",
    answer: "Smart Tech SaaS is a comprehensive cloud-based school management platform that helps educational institutions manage students, teachers, timetables, assessments, communications, and more in one integrated system.",
  },
  {
    question: "Is Smart Tech SaaS suitable for my school size?",
    answer: "Absolutely. Smart Tech SaaS is designed to scale from small schools with 100 students to large districts with tens of thousands of students. Our Basic plan is perfect for small schools, while Standard and Premium plans accommodate growing and large institutions.",
  },
  {
    question: "How long does it take to set up?",
    answer: "Most schools are up and running within a week. Our team provides onboarding support to help you import data, configure settings, and train your staff. The Basic plan can be set up in as little as one day.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use industry-standard encryption for data at rest and in transit. Our infrastructure is hosted on secure cloud servers with regular security audits, SOC 2 compliance, and GDPR compliance. We never share your data with third parties.",
  },
  {
    question: "Can I import data from my existing system?",
    answer: "Yes, we offer data import tools that support CSV, Excel, and common school management system formats. Our onboarding team will assist with data migration to ensure a smooth transition.",
  },
  {
    question: "Do you offer training for staff?",
    answer: "Yes. Every plan includes access to our knowledge base, video tutorials, and documentation. Standard and Premium plans include live training sessions for administrators and teachers.",
  },
  {
    question: "Can parents access the platform?",
    answer: "Yes, parents get their own portal where they can view their child's attendance, grades, timetable, communicate with teachers, receive announcements, and more. The parent portal is available on web and mobile.",
  },
  {
    question: "Is there a mobile app available?",
    answer: "Yes, Smart Tech SaaS is fully responsive on mobile browsers. We also offer dedicated mobile apps for iOS and Android for teachers and parents.",
  },
  {
    question: "Can I customize the platform for my school's branding?",
    answer: "Standard and Premium plans allow you to customize the platform with your school's logo, colors, and branding. Premium plans also support custom domain and white-label options.",
  },
  {
    question: "What kind of support do you offer?",
    answer: "Basic plans include email support. Standard plans include priority email and chat support. Premium plans include dedicated account management and 24/7 phone, chat, and email support with a 99.99% SLA guarantee.",
  },
  {
    question: "How does the AI Tutor work?",
    answer: "The AI Tutor uses advanced natural language processing to help students with homework, generate practice questions, explain concepts, and provide personalized learning recommendations. It is available on the Premium plan.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Yes, you can cancel your subscription at any time. There are no long-term contracts. If you cancel, you will retain access to your data and can export it before your subscription ends.",
  },
];

export default function FAQPage() {
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about Smart Tech SaaS. Can not find what you are looking for? Contact our team.
          </p>
        </div>
      </section>

      {/* FAQ List */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-primary/30 transition-colors"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform shrink-0" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Have Questions?</h2>
          <p className="text-gray-600 mb-6">We are here to help. Reach out to our team anytime.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors"
            >
              Contact Us
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-primary hover:text-primary transition-colors"
            >
              Request a Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
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
