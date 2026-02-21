import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { UserRole } from '@/types/database';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, branch_id')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as UserRole) ?? 'SERVICE_ADVISOR';
  const links = ROLE_LINKS[role];
  const roleLabel = ROLE_LABEL[role];

  let branchName = '—';
  if (profile?.branch_id) {
    const { data: branch } = await supabase
      .from('branches')
      .select('name')
      .eq('id', profile.branch_id)
      .single();
    branchName = branch?.name ?? '—';
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-2 flex items-center justify-between">
        <span className="font-bold">CRM תהילה</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{profile?.full_name ?? user.email}</span>
          <span className="text-gray-500">{roleLabel}</span>
          <span className="text-gray-500">{branchName}</span>
          <a href="/logout" className="text-blue-600 underline">
            התנתק
          </a>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-48 border-l bg-gray-50 p-3 flex flex-col gap-1">
          {links.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 rounded hover:bg-gray-200 text-sm"
            >
              {label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 p-4 bg-gray-100">{children}</main>
      </div>
    </div>
  );
}
