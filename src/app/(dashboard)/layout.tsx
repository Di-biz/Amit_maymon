import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { UserRole } from '@/types/database';
import { PreviewRoleSwitcher } from '@/components/preview/PreviewRoleSwitcher';

const ROLE_LINKS: Record<UserRole, { label: string; href: string }[]> = {
  SERVICE_MANAGER: [
    { label: 'תיקים', href: '/cases' },
    { label: 'תוספות', href: '/extras' },
    { label: 'התראות', href: '/notifications' },
  ],
  OFFICE: [
    { label: 'סגירה', href: '/closure' },
    { label: 'התראות', href: '/notifications' },
  ],
  CEO: [
    { label: 'אישורים', href: '/approvals' },
    { label: 'תיקים', href: '/cases' },
    { label: 'התראות', href: '/notifications' },
  ],
  PAINTER: [
    { label: 'תוספת חדשה', href: '/extras/new' },
    { label: 'התוספות שלי', href: '/extras/mine' },
    { label: 'התראות', href: '/notifications' },
  ],
  SERVICE_ADVISOR: [
    { label: 'תיקים', href: '/cases' },
    { label: 'התראות', href: '/notifications' },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  SERVICE_MANAGER: 'מנהל שירות',
  OFFICE: 'משרד',
  CEO: 'מנכ"ל',
  PAINTER: 'פחח',
  SERVICE_ADVISOR: 'יועצת שירות',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role, branch_id')
    .eq('id', user.id)
    .single();

  const profile = profileData as { full_name?: string; role: string; branch_id: string | null } | null;
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  const role = (profile?.role as UserRole) ?? 'SERVICE_ADVISOR';
  const links = isPreview
    ? [
        { label: 'תיקים', href: '/cases' },
        { label: 'סגירה', href: '/closure' },
        { label: 'אישורים', href: '/approvals' },
        { label: 'תוספות', href: '/extras' },
        { label: 'התראות', href: '/notifications' },
      ]
    : ROLE_LINKS[role];
  const roleLabel = ROLE_LABEL[role];

  let branchName = '—';
  if (profile?.branch_id) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('name')
      .eq('id', profile.branch_id)
      .single();
    const branch = branchData as { name: string } | null;
    branchName = branch?.name ?? '—';
  }

  return (
    <div className="min-h-screen flex flex-col">
      {isPreview && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-900">
          מצב תצוגה מקדימה — ללא התחברות וללא מסד נתונים. הנתונים להמחשה בלבד.
        </div>
      )}
      {isPreview && <PreviewRoleSwitcher />}
      <header className="border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚗</span>
            <span className="font-bold text-xl">CRM תהילה</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span className="font-medium">{profile?.full_name ?? user.email}</span>
            </div>
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span>{roleLabel}</span>
            </div>
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span>{branchName}</span>
            </div>
            <a href="/logout" className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">
              התנתק
            </a>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 border-l bg-gradient-to-b from-gray-50 to-white p-4 flex flex-col gap-2 shadow-sm">
          {links.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="px-4 py-3 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-sm font-medium transition-all hover:shadow-md flex items-center gap-2 group"
            >
              <span className="group-hover:scale-110 transition-transform">→</span>
              <span>{label}</span>
            </Link>
          ))}
        </aside>
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">{children}</main>
      </div>
    </div>
  );
}
