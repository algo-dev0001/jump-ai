import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">AI Advisor Agent</h1>
          <p className="text-xl text-gray-600 mb-8">
            Your intelligent assistant for financial advisory
          </p>
          
          <div className="flex gap-4 justify-center mb-8">
            <Link 
              href="/login"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Sign In
            </Link>
            <Link 
              href="/dashboard"
              className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition"
            >
              Dashboard
            </Link>
          </div>

          <div className="text-sm text-gray-500">
            <p>Milestone 0: Repo & Base Setup ✓</p>
          </div>
        </div>
      </div>
    </main>
  );
}

