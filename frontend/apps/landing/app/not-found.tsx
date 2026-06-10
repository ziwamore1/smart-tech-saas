import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Home, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
          <div className="flex justify-center mb-6">
            <GraduationCap className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-7xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            Sorry, the page you are looking for does not exist or has been moved. Let us get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
