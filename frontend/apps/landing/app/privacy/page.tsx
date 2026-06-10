import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Smart Tech SaaS privacy policy. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
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

      {/* Content */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: January 1, 2025</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-600 leading-relaxed">
                Smart Tech SaaS ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our school management platform and website.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                By using Smart Tech SaaS, you agree to the collection and use of information in accordance with this policy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              <p className="text-gray-600 leading-relaxed mb-4">We collect the following types of information:</p>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Personal Information</h3>
              <p className="text-gray-600 leading-relaxed">
                When you register for an account, we may collect your name, email address, phone number, school name, and job title. For students, we collect name, date of birth, grade level, parent/guardian contact information, and academic records.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">Usage Data</h3>
              <p className="text-gray-600 leading-relaxed">
                We automatically collect information about how you interact with our platform, including log data, device information, browser type, pages visited, time spent, and feature usage patterns.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 leading-relaxed mb-4">We use the collected information for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>To provide, maintain, and improve our school management platform</li>
                <li>To process transactions and manage accounts</li>
                <li>To communicate with you about updates, security alerts, and support</li>
                <li>To generate analytics and reports for school administrators</li>
                <li>To comply with legal obligations and enforce our terms</li>
                <li>To detect, prevent, and address technical issues or fraud</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
              <p className="text-gray-600 leading-relaxed">
                We implement industry-standard security measures including encryption at rest and in transit, regular security audits, access controls, and secure data centers. However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your data.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Retention</h2>
              <p className="text-gray-600 leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide you services. You may request deletion of your data at any time. We will retain and use your information as necessary to comply with legal obligations, resolve disputes, and enforce agreements.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Third-Party Services</h2>
              <p className="text-gray-600 leading-relaxed">
                We may employ third-party companies and individuals to facilitate our service, provide service on our behalf, or assist us in analyzing how our service is used. These third parties have access to your personal information only to perform these tasks and are obligated not to disclose or use it for any other purpose.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Children&apos;s Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                We comply with COPPA (Children&apos;s Online Privacy Protection Act) and similar regulations. Schools using our platform are responsible for obtaining parental consent for students under 13. We do not knowingly collect personal information from children without appropriate consent.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Your Rights</h2>
              <p className="text-gray-600 leading-relaxed mb-4">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>Access, update, or delete your personal information</li>
                <li>Object to or restrict processing of your data</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
                <li>Lodge a complaint with a data protection authority</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Contact Us</h2>
              <p className="text-gray-600 leading-relaxed">
                If you have questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-gray-600 mt-2">
                Email: privacy@smarttechsaas.com<br />
                Phone: +1 (555) 123-4567<br />
                Address: 123 Tech Street, Suite 100, San Francisco, CA 94105
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
