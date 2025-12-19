export default function DashboardPage() {
  // TODO: Add auth gate in Milestone 1
  const isAuthenticated = false;

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
          <p className="text-gray-600 mb-4">Please sign in to continue</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Go to Sign In
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">AI Advisor Agent</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Chat</h2>
            <p className="text-gray-600 text-sm">Coming in Milestone 2</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Tasks</h2>
            <p className="text-gray-600 text-sm">Coming in Milestone 3</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Instructions</h2>
            <p className="text-gray-600 text-sm">Coming in Milestone 5</p>
          </div>
        </div>
      </div>
    </main>
  );
}

