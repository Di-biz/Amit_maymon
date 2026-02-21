import Link from 'next/link';
import { redirect } from 'next/navigation';

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export default function HomePage() {
  if (isPreview) redirect('/cases');

  return (
    <main className="min-h-screen p-8 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Tehila Bodyshop CRM</h1>
      <p className="text-gray-600">מערכת ניהול תיקי פחחות — מהגעת רכב ועד סגירה.</p>
      <Link href="/login" className="text-blue-600 underline">
        התחברות
      </Link>
    </main>
  );
}
