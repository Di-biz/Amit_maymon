'use client';

import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BlockersBadges } from '@/components/ui/BlockersBadges';
import type { PartsStatus } from '@/types/database';

interface CaseRow {
  id: string;
  plate: string;
  claim: string;
  opened_at: string | null;
  age: string;
  parts_status: PartsStatus;
  general_status: string;
  hasExtrasInTreatment: boolean;
  approvalBlocked: boolean;
}

export function CasesTable({
  cases,
  role,
}: {
  cases: CaseRow[];
  role: string | null;
}) {
  const router = useRouter();
  const columns: Column<CaseRow>[] = [
    { key: 'plate', label: 'מספר רישוי' },
    { key: 'claim', label: 'תביעה' },
    {
      key: 'opened_at',
      label: 'נפתח',
      render: (row) =>
        row.opened_at
          ? new Date(row.opened_at).toLocaleDateString('he-IL')
          : '—',
    },
    { key: 'age', label: 'גיל רכב' },
    { key: 'parts_status', label: 'חלקים' },
    {
      key: 'blockers',
      label: 'חסימות',
      render: (row) => (
        <BlockersBadges
          partsStatus={row.parts_status}
          hasExtrasInTreatment={row.hasExtrasInTreatment}
          approvalBlocked={row.approvalBlocked}
        />
      ),
    },
  ];

  return (
    <DataTable<CaseRow>
      columns={columns}
      data={cases}
      searchPlaceholder="חיפוש רישוי, תביעה..."
      searchKeys={['plate', 'claim']}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/cases/${row.id}`)}
    />
  );
}
