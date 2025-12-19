'use client';

interface ChatHeaderProps {
  onClearHistory: () => void;
  onBack: () => void;
  isClearing?: boolean;
}

export function ChatHeader({ onClearHistory, onBack, isClearing }: ChatHeaderProps) {
  return (
    <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">Advisor AI</h1>
          <p className="text-xs text-gray-500">Your financial advisory assistant</p>
        </div>
      </div>
      <button
        onClick={onClearHistory}
        disabled={isClearing}
        className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      >
        {isClearing ? 'Clearing...' : 'Clear Chat'}
      </button>
    </header>
  );
}

