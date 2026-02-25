import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const PARTS_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: 'חלקים זמינים', color: 'text-green-700 bg-green-50 border-green-200' },
  ORDERED: { label: 'חלקים הוזמנו', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  NO_PARTS: { label: 'אין חלקים', color: 'text-red-700 bg-red-50 border-red-200' },
};

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  PRIVATE: 'פרטי',
  COMPREHENSIVE: 'מקיף',
  THIRD_PARTY: 'צד ג׳',
};

export default async function ClosurePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  const profile = profileData as { role: string; branch_id: string | null } | null;
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  if (!isPreview && profile?.role !== 'OFFICE' && profile?.role !== 'CEO') {
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
      opened_at,
      parts_status,
      insurance_type,
      claim_number,
      cars(license_plate, make, model),
      branches(name)
    `
    )
    .is('closed_at', null);

  if (profile && profile.role !== 'CEO' && profile.branch_id) {
    casesQuery = casesQuery.eq('branch_id', profile.branch_id);
  }

  const { data: casesRows } = await casesQuery;

  const runIds = await (async () => {
    if (!casesRows?.length) return [] as { id: string; case_id: string }[];
    const { data: runsData } = await supabase
      .from('case_workflow_runs')
      .select('id, case_id')
      .in('case_id', casesRows.map((c) => (c as { id: string }).id))
      .eq('workflow_type', 'PROFESSIONAL')
      .eq('status', 'COMPLETED');
    return (runsData ?? []) as { id: string; case_id: string }[];
  })();

  const readyCaseIds = new Set(runIds.map((r) => r.case_id));
  const list = (casesRows ?? []).filter((c) => readyCaseIds.has((c as { id: string }).id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">תיקים לסגירה</h1>
          <p className="text-sm text-gray-500 mt-1">תיקים שהעבודה הסתיימה ומחכים לטיפול משרדי</p>
        </div>
        {list.length > 0 && (
          <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
            {list.length} תיקים ממתינים
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">אין תיקים לסגירה</h3>
          <p className="text-gray-400 text-sm">כשתיקים יסיימו את שלב העבודה הם יופיעו כאן</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((c) => {
            const row = c as {
              id: string;
              case_key: string | null;
              opened_at: string | null;
              parts_status: string | null;
              insurance_type: string | null;
              claim_number: string | null;
              cars: { license_plate: string | null; make: string | null; model: string | null } | null;
              branches: { name: string } | null;
            };
            const car = Array.isArray(row.cars) ? row.cars[0] : row.cars;
            const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
            const parts = row.parts_status ? PARTS_STATUS_LABELS[row.parts_status] : null;
            const daysOpen = row.opened_at
              ? Math.floor((Date.now() - new Date(row.opened_at).getTime()) / 86400000)
              : null;

            return (
              <Link key={row.id} href={`/closure/${row.id}`} className="block group">
                <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all group-hover:bg-indigo-50/30">
                  <div className="flex items-start justify-between gap-4">
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 truncate">
                          {row.case_key ?? car?.license_plate ?? row.id}
                        </h3>
                        {row.insurance_type && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {INSURANCE_TYPE_LABELS[row.insurance_type] ?? row.insurance_type}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {car?.license_plate && (
                          <span className="flex items-center gap-1">
                            <span>🚗</span>
                            <span className="font-medium text-gray-700">{car.license_plate}</span>
                            {car.make && <span>{car.make} {car.model}</span>}
                          </span>
                        )}
                        {branch?.name && (
                          <span className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{branch.name}</span>
                          </span>
                        )}
                        {row.opened_at && (
                          <span className="flex items-center gap-1">
                            <span>📅</span>
                            <span>נפתח {new Date(row.opened_at).toLocaleDateString('he-IL')}</span>
                          </span>
                        )}
                        {daysOpen !== null && (
                          <span className={`flex items-center gap-1 font-medium ${daysOpen > 14 ? 'text-red-600' : daysOpen > 7 ? 'text-amber-600' : 'text-gray-500'}`}>
                            <span>⏱</span>
                            <span>{daysOpen} ימים</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {parts && (
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${parts.color}`}>
                          {parts.label}
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-green-100 text-green-800 border border-green-200 rounded-lg text-xs font-medium">
                        ✓ מוכן למשרד
                      </span>
                      <span className="text-indigo-600 text-sm font-medium group-hover:text-indigo-700 flex items-center gap-1">
                        פתח תיק <span className="group-hover:translate-x-[-2px] transition-transform">←</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
