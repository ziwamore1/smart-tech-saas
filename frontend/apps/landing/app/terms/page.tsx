import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Smart Tech SaaS terms of service. Read the terms governing the use of our school management platform.",
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: January 1, 2025</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                By accessing or using Smart Tech SaaS ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to all the terms, you may not access or use the Platform. These terms apply to all visitors, users, and others who access or use the Platform.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-600 leading-relaxed">
                Smart Tech SaaS provides a cloud-based school management platform that includes student information systems, timetable management, assessment tools, communication features, analytics, and related services. We reserve the right to modify, suspend, or discontinue any aspect of the Platform at any time.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
              <p className="text-gray-600 leading-relaxed mb-4">You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Ensuring the accuracy of all information you provide</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Schools are responsible for managing user roles and permissions for their staff, students, and parents.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Acceptable Use</h2>
              <p className="text-gray-600 leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
                <li>Attempt to gain unauthorized access to any part of the Platform</li>
                <li>Upload or transmit viruses, malware, or malicious code</li>
                <li>Interfere with or disrupt the Platform or servers</li>
                <li>Use the Platform to send unsolicited communications (spam)</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
                <li>Access or use the Platform in a way that could damage or impair our systems</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Ownership and Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                You retain all ownership rights to the data you enter into the Platform. We claim no intellectual property rights over the data you provide. We will not use your data for purposes other than providing and improving the Platform, as outlined in our Privacy Policy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Payment and Billing</h2>
              <p className="text-gray-600 leading-relaxed">
                Subscription fees are billed in advance on an annual or monthly basis. Fees are non-refundable except as expressly stated in our refund policy. We may change our fees with 30 days notice. Late payments may result in suspension of service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Service Level Agreement</h2>
              <p className="text-gray-600 leading-relaxed">
                We strive to maintain 99.9% uptime for the Platform (99.99% for Premium plans). Service credits may be provided for verified downtime exceeding our SLA commitments. Scheduled maintenance with advance notice is excluded from uptime calculations.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-600 leading-relaxed">
                To the maximum extent permitted by law, Smart Tech SaaS shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability for any claims under these terms shall not exceed the amount you paid us in the 12 months preceding the claim.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Termination</h2>
              <p className="text-gray-600 leading-relaxed">
                Either party may terminate these terms at any time. Upon termination, your access to the Platform will be revoked. We will provide you with a reasonable period to export your data. We may terminate or suspend your account immediately for violation of these terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of material changes via email or platform notification. Continued use of the Platform after changes constitutes acceptance of the new terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
              <p className="text-gray-600 leading-relaxed">
                These terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved in the courts of San Francisco County, California.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contact Information</h2>
              <p className="text-gray-600 leading-relaxed">
                For questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-gray-600 mt-2">
                Email: legal@smarttechsaas.com<br />
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
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
