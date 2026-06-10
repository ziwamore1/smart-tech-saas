import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, ExternalLink, Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Redirecting",
  description: "Redirecting to Smart Tech SaaS application portal.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
          <div className="flex justify-center mb-6">
            <GraduationCap className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Redirecting to Smart Tech SaaS...</h1>
          <p className="text-gray-600 mb-8">
            You are being redirected to the Smart Tech SaaS application portal where you can sign up or sign in to your account.
          </p>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-6" />
          <a
            href="https://app.smarttechsaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors"
          >
            Go to Application Portal
            <ExternalLink className="h-4 w-4" />
          </a>
          <p className="mt-6 text-sm text-gray-500">
            Not redirected? <a
              href="https://app.smarttechsaas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >Click here</a> to go to the app.
          </p>
          <div className="mt-6">
            <Link href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
