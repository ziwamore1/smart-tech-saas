import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, CheckCircle, ArrowRight, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the right plan for your school. Basic, Standard, and Premium tier pricing for Smart Tech SaaS school management platform.",
};

const tiers = [
  {
    name: "Basic",
    price: "Free",
    description: "Perfect for small schools getting started with digital management.",
    features: [
      "Up to 200 students",
      "Up to 20 teachers",
      "Student profiles",
      "Attendance tracking",
      "Basic timetable",
      "Email support",
      "1 school admin",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Standard",
    price: "$9",
    period: "/student/year",
    description: "Ideal for growing schools with expanding needs.",
    features: [
      "Up to 1,000 students",
      "Unlimited teachers",
      "Everything in Basic",
      "Smart timetable generator",
      "Assessment & results",
      "Parent communication",
      "Analytics dashboard",
      "Priority email & chat support",
      "Up to 5 school admins",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "Custom",
    period: "",
    description: "For large institutions and school districts with enterprise requirements.",
    features: [
      "Unlimited students",
      "Unlimited teachers",
      "Everything in Standard",
      "AI Tutor integration",
      "Certificate management",
      "Custom branding",
      "API access",
      "Dedicated account manager",
      "99.99% SLA guarantee",
      "Custom integrations",
      "24/7 phone & chat support",
      "Unlimited admins",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function PricingPage() {
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
            <Link href="/features" className="text-gray-600 hover:text-primary transition-colors">Features</Link>
            <Link href="/about" className="text-gray-600 hover:text-primary transition-colors">About</Link>
            <Link href="/contact" className="text-gray-600 hover:text-primary transition-colors">Contact</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your school's needs. Upgrade or downgrade at any time.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border-2 p-8 flex flex-col ${
                  tier.highlighted
                    ? "border-primary bg-primary/5 shadow-xl scale-105 md:scale-105 relative"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h2>
                  <p className="text-gray-600 mb-4">{tier.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                    {tier.period && <span className="text-gray-500">{tier.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.name === "Premium" ? (
                  <Link
                    href="/contact"
                    className={`w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                      tier.highlighted
                        ? "bg-primary text-white hover:bg-primary-light"
                        : "border-2 border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <a
                    href="https://app.smarttechsaas.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                      tier.highlighted
                        ? "bg-primary text-white hover:bg-primary-light"
                        : "border-2 border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {tier.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Note */}
          <div className="mt-12 bg-gray-50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <span className="font-semibold text-gray-900">Need a custom plan?</span>
            </div>
            <p className="text-gray-600">
              All plans above are our standard offerings. Sign up to get started, and contact us for custom pricing tailored to your institution's specific needs.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Have Questions About Pricing?</h2>
          <p className="text-gray-600 mb-6">Check our FAQ or contact our sales team for more details.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/faq" className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-light transition-colors">
              View FAQ
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-light transition-colors">
              Contact Us
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Smart Tech SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
