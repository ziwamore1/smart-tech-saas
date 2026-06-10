import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Smart Tech SaaS - Modern School Management System",
    template: "%s | Smart Tech SaaS",
  },
  description:
    "Comprehensive school management platform for educational institutions. Manage students, teachers, timetables, grades, and communications.",
  keywords: ["school management", "education SaaS", "school software", "student management", "timetable generator"],
  openGraph: {
    title: "Smart Tech SaaS - Modern School Management System",
    description: "Complete school management platform for educational institutions.",
    type: "website",
    locale: "en_US",
    siteName: "Smart Tech SaaS",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
