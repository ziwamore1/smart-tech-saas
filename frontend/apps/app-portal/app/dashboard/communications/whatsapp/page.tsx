'use client';

import Link from 'next/link';

export default function WhatsAppCommsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fa fa-whatsapp text-3xl text-green-600"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">WhatsApp Communications</h1>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Send messages and notifications via WhatsApp. This feature is coming soon.
        </p>
        <Link
          href="/dashboard/communications"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
        >
          <i className="fa fa-arrow-left"></i>
          Back to Communications
        </Link>
      </div>
    </div>
  );
}
