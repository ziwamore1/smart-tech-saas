'use client';

import { useState } from 'react';

interface WelcomeScreenProps {
  userName?: string;
  onStartSetup: () => void;
  onTryDemo: () => void;
}

export function WelcomeScreen({ userName, onStartSetup, onTryDemo }: WelcomeScreenProps) {
  const [showWizard, setShowWizard] = useState(false);

  const displayName = userName || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {displayName}!
        </h1>
        
        <p className="text-lg text-gray-600 mb-2">
          Let&apos;s create your first timetable.
        </p>
        
        <p className="text-gray-500 mb-8">
          This takes about <span className="font-semibold text-blue-600">5–10 minutes</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={onStartSetup}
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            🚀 Start Setup
          </button>
          
          <button
            onClick={onTryDemo}
            className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 text-lg font-semibold rounded-xl hover:border-gray-300 transition-colors"
          >
            🎬 Try Demo School
          </button>
        </div>

        <p className="text-gray-500">
          See how it works before entering your data
        </p>
      </div>
    </div>
  );
}

export default WelcomeScreen;