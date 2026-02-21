import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ExtrasManagerList } from './ExtrasManagerList';

export default async function ExtrasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'SERVICE_MANAGER' && profile?.role !== 'CEO') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">תוספות</h1>
        <p className="text-gray-500">אין גישה לדף זה.</p>
      </div>
    );
  }

  let caseIds: string[] | null = null;
  if (profile.role !== 'CEO' && profile.branch_id) {
    const { data: branchCases } = await supabase
      .from('cases')
      .select('id')
      .eq('branch_id', profile.branch_id);
    caseIds = (branchCases ?? []).map((c) => c.id);
  }

  let query = supabase
    .from('bodywork_extras')
    .select(`
      id,
      case_id,
      description,
      image_path,
      status,
      created_at,
      cases(case_key, cars(license_plate))
    `)
    .order('created_at', { ascending: false });

  if (caseIds && caseIds.length > 0) {
    query = query.in('case_id', caseIds);
  } else if (caseIds && caseIds.length === 0) {
    query = query.eq('case_id', '00000000-0000-0000-0000-000000000000');
  }

  const { data: rows } = await query;

  const extras = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      case_id: string;
      description: string;
      image_path: string;
      status: string;
      created_at: string;
      cases: { case_key: string | null; cars: { license_plate: string | null } | null } | null;
    };
    const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    const car = c && (Array.isArray(c.cars) ? c.cars[0] : c.cars);
    return {
      id: row.id,
      case_id: row.case_id,
      description: row.description,
      image_path: row.image_path,
      status: row.status,
      created_at: row.created_at,
      case_key: c?.case_key ?? null,
      plate: car?.license_plate ?? '—',
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">תוספות פחחות</h1>
      <ExtrasManagerList extras={extras} />
    </div>
  );
}
