'use client';

import Link from 'next/link';

interface AccessDeniedProps {
  requiredRoles?: string[];
  message?: string;
}

export function AccessDenied({ requiredRoles, message }: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 shadow-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-800 mb-3">Access Denied</h1>
          <p className="text-red-600 mb-4">
            {message || 'You are not permitted to view this page.'}
          </p>
          {requiredRoles && requiredRoles.length > 0 && (
            <div className="bg-white/60 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-medium text-red-700 mb-1.5">This page requires one of these roles:</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {requiredRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
