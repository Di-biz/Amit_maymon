import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ClosurePage() {
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

  if (profile?.role !== 'OFFICE' && profile?.role !== 'CEO') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">סגירה</h1>
        <p className="text-gray-500">אין גישה לדף זה.</p>
      </div>
    );
  }

  let casesQuery = supabase
    .from('cases')
    .select(
      `
      id,
      case_key,
      closed_at,
      treatment_finished_at,
      cars(license_plate)
    `
    )
    .is('closed_at', null);

  if (profile.role !== 'CEO' && profile.branch_id) {
    casesQuery = casesQuery.eq('branch_id', profile.branch_id);
  }

  const { data: casesRows } = await casesQuery;

  const runIds = await (async () => {
    if (!casesRows?.length) return [];
    const { data: runs } = await supabase
      .from('case_workflow_runs')
      .select('id, case_id')
      .in('case_id', casesRows.map((c) => (c as { id: string }).id))
      .eq('workflow_type', 'PROFESSIONAL')
      .eq('status', 'COMPLETED');
    return runs ?? [];
  })();

  const readyCaseIds = new Set(runIds.map((r) => r.case_id));
  const list = (casesRows ?? []).filter((c) => readyCaseIds.has((c as { id: string }).id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">תיקים לסגירה</h1>
      <p className="text-sm text-gray-500 mb-4">תיקים שמוכנים למשרד (READY_FOR_OFFICE בוצע)</p>
      <ul className="divide-y border rounded bg-white">
        {list.length === 0 ? (
          <li className="p-4 text-gray-500">אין תיקים לסגירה</li>
        ) : (
          list.map((c) => {
            const row = c as {
              id: string;
              case_key: string | null;
              cars: { license_plate: string | null } | null;
            };
            const car = Array.isArray(row.cars) ? row.cars[0] : row.cars;
            return (
              <li key={row.id} className="p-4 hover:bg-gray-50">
                <Link href={`/closure/${row.id}`} className="block">
                  <span className="font-medium">{row.case_key ?? row.id}</span>
                  <span className="text-gray-500 mr-2"> — {car?.license_plate ?? '—'}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
