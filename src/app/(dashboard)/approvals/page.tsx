import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ApprovalsList } from './ApprovalsList';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profile = profileData as { role: string } | null;
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  if (!isPreview && profile?.role !== 'CEO') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">אישורים</h1>
        <p className="text-gray-500">אין גישה לדף זה.</p>
      </div>
    );
  }

  const { data: pending } = await supabase
    .from('ceo_approvals')
    .select(`
      id,
      case_id,
      approval_type,
      status,
      rejection_note,
      cases(
        id,
        case_key,
        fixcar_link,
        parts_status,
        cars(license_plate),
        branches(name)
      )
    `)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  const approvals = (pending ?? []).map((a) => {
    const row = a as {
      id: string;
      case_id: string;
      approval_type: string;
      status: string;
      rejection_note: string | null;
      cases: {
        id: string;
        case_key: string | null;
        fixcar_link: string | null;
        parts_status: string;
        cars: { license_plate: string | null } | null;
        branches: { name: string } | null;
      } | null;
    };
    const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    const car = c && (Array.isArray(c.cars) ? c.cars[0] : c.cars);
    const branch = c && (Array.isArray(c.branches) ? c.branches[0] : c.branches);
    return {
      id: row.id,
      case_id: row.case_id,
      approval_type: row.approval_type,
      rejection_note: row.rejection_note,
      case_key: c?.case_key ?? null,
      fixcar_link: c?.fixcar_link ?? null,
      parts_status: c?.parts_status ?? null,
      plate: car?.license_plate ?? '—',
      branch_name: branch?.name ?? '—',
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">אישורי עמית</h1>
      <ApprovalsList approvals={approvals} />
    </div>
  );
}
