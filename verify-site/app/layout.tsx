import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMART_TECH · Document Verification',
  description: 'Verify the authenticity of SMART_TECH-issued documents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
