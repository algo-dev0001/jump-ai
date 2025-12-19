'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      switch (error) {
        case 'oauth_denied':
          setErrorMessage('OAuth access was denied. Please try again.');
          break;
        case 'no_code':
          setErrorMessage('No authorization code received.');
          break;
        case 'oauth_failed':
          setErrorMessage('OAuth authentication failed. Please try again.');
          break;
        default:
          setErrorMessage('An unknown error occurred.');
      }
      return;
    }

    if (token) {
      // Store token and redirect to dashboard
      localStorage.setItem('token', token);
      setStatus('success');

      // Small delay to show success message
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } else {
      setStatus('error');
      setErrorMessage('No authentication token received.');
    }
  }, [searchParams, router]);

  return (
    <div className="bg-white shadow-md rounded-lg p-8 text-center">
      {status === 'loading' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold">Completing sign in...</h1>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-green-600">Sign in successful!</h1>
          <p className="text-gray-600 mt-2">Redirecting to dashboard...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-red-500 text-5xl mb-4">✕</div>
          <h1 className="text-xl font-semibold text-red-600">Sign in failed</h1>
          <p className="text-gray-600 mt-2">{errorMessage}</p>
          <a
            href="/login"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try again
          </a>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h1 className="text-xl font-semibold">Loading...</h1>
            </div>
          }
        >
          <AuthCallbackContent />
        </Suspense>
      </div>
    </main>
  );
}
