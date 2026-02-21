'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // In PREVIEW mode, check if we should show login page
  useEffect(() => {
    // Check if user wants to see login (from logout or direct navigation)
    const showLogin = sessionStorage.getItem('preview_show_login') || 
                     document.cookie.includes('preview_show_login=true');
    
    if (isPreview && !showLogin) {
      // Auto-redirect to cases if not explicitly showing login
      const timer = setTimeout(() => {
        router.replace('/cases');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (isPreview && showLogin) {
      // Clear the flag after showing
      sessionStorage.removeItem('preview_show_login');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    if (isPreview) {
      // In PREVIEW mode, just redirect to cases
      setLoading(false);
      sessionStorage.removeItem('preview_show_login');
      router.push('/cases');
      return;
    }
    
    try {
      const result = await loginAction({ email, password });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      const isRedirect = err && typeof err === 'object' && (err as { digest?: string }).digest === 'NEXT_REDIRECT';
      if (!isRedirect) setError('שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">התחברות — CRM תהילה</h1>
          {isPreview && (
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
              מצב תצוגה מקדימה — התחברות לא נדרשת. תועבר אוטומטית בעוד רגע.
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              dir="ltr"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              dir="ltr"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {loading ? 'מתחבר...' : isPreview ? 'המשך למצב תצוגה מקדימה' : 'התחבר'}
          </button>
          {isPreview && (
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('preview_show_login', 'true');
                router.push('/cases');
              }}
              className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors mt-2"
            >
              המשך למצב תצוגה מקדימה
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
