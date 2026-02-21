import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { PartsStatus } from '@/types/database';
import { CasesTable } from './CasesTable';
import { CreateCaseButton } from './CreateCaseButton';

export default async function CasesPage() {
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
  const role = profile?.role ?? null;
  const branchId = profile?.branch_id ?? null;

  let casesQuery = supabase
    .from('cases')
    .select(
      `
      id,
      case_key,
      claim_number,
      opened_at,
      parts_status,
      general_status,
      closed_at,
      cars!inner(license_plate, first_registration_date),
      branch_id
    `
    )
    .order('opened_at', { ascending: false });

  if (role !== 'CEO' && branchId) {
    casesQuery = casesQuery.eq('branch_id', branchId);
  }

  const { data: casesRows } = await casesQuery;

  const openCases = (casesRows ?? []).filter((c) => !(c as { closed_at: string | null }).closed_at);

  const casesWithMeta = openCases.map((c) => {
    const row = c as {
      id: string;
      case_key: string | null;
      claim_number: string | null;
      opened_at: string | null;
      parts_status: string;
      general_status: string;
      cars: { license_plate: string | null; first_registration_date: string | null } | null;
    };
    const car = Array.isArray(row.cars) ? row.cars[0] : row.cars;
    const plate = car?.license_plate ?? '—';
    const firstReg = car?.first_registration_date ?? null;
    let age: string = '—';
    if (firstReg) {
      const years = (Date.now() - new Date(firstReg).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      age = years < 1 ? '<1' : Math.floor(years).toString();
    }
    return {
      id: row.id,
      plate,
      claim: row.claim_number ?? '—',
      opened_at: row.opened_at,
      age,
      parts_status: row.parts_status as PartsStatus,
      general_status: row.general_status,
    };
  });

  const caseIds = openCases.map((c) => (c as { id: string }).id);
  const { data: extrasByCaseData } = await supabase
    .from('bodywork_extras')
    .select('case_id')
    .eq('status', 'IN_TREATMENT')
    .in('case_id', caseIds);
  const extrasByCase = (extrasByCaseData ?? []) as { case_id: string }[];
  const caseIdsWithExtras = new Set(extrasByCase.map((e) => e.case_id));

  const { data: approvalsByCaseData } = await supabase
    .from('ceo_approvals')
    .select('case_id, status')
    .in('case_id', caseIds);
  const approvalsByCase = (approvalsByCaseData ?? []) as { case_id: string; status: string }[];
  const caseIdsApprovalBlocked = new Set<string>();
  for (const a of approvalsByCase) {
    if (a.status !== 'APPROVED') caseIdsApprovalBlocked.add(a.case_id);
  }

  const canCreate = role === 'SERVICE_MANAGER' || role === 'OFFICE';
  const isCeo = role === 'CEO';
  let branches: { id: string; name: string }[] = [];
  if (isCeo) {
    const { data: b } = await supabase.from('branches').select('id, name');
    branches = b ?? [];
  }

  const totalCases = casesWithMeta.length;
  const casesWithBlockers = casesWithMeta.filter((c) => 
    caseIdsWithExtras.has(c.id) || caseIdsApprovalBlocked.has(c.id)
  ).length;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📁</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">תיקים פתוחים</h1>
              <p className="text-gray-600 text-sm mt-1">
                {totalCases} תיקים פעילים {casesWithBlockers > 0 && `• ${casesWithBlockers} עם חסימות`}
              </p>
            </div>
          </div>
          {canCreate && (
            <CreateCaseButton
              branchId={branchId}
              branches={branches}
              isCeo={isCeo}
            />
          )}
        </div>
        {role === 'SERVICE_MANAGER' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-800 font-medium">
              💡 <strong>ערן:</strong> לחץ על תיק כדי לראות את הצ'קליסט עבודה ולסמן שלבים כבוצעים
            </p>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <CasesTable
          cases={casesWithMeta.map((c) => ({
            ...c,
            hasExtrasInTreatment: caseIdsWithExtras.has(c.id),
            approvalBlocked: caseIdsApprovalBlocked.has(c.id),
          }))}
          role={role}
        />
      </div>
    </div>
  );
}
