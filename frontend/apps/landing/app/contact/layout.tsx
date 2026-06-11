import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with SMART_TECH. Contact our team for support, sales inquiries, or partnership opportunities.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
