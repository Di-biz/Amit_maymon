'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateExtraStatus } from '@/app/actions/extras';
import type { ExtraStatus } from '@/types/database';

interface ExtraRow {
  id: string;
  case_id: string;
  description: string;
  image_path: string;
  status: ExtraStatus;
  created_at: string;
  case_key: string | null;
  plate: string;
}

export function ExtrasManagerList({ extras }: { extras: ExtraRow[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleStatusChange(extraId: string, status: ExtraStatus) {
    setUpdatingId(extraId);
    await updateExtraStatus({ extra_id: extraId, status });
    setUpdatingId(null);
    router.refresh();
  }

  if (extras.length === 0) return <p className="text-gray-500">אין תוספות</p>;

  return (
    <ul className="border rounded bg-white divide-y">
      {extras.map((e) => (
        <li key={e.id} className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{e.description}</p>
            <p className="text-sm text-gray-500">
              תיק: {e.case_key ?? e.plate} — {e.status}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={e.status}
              onChange={(ev) => handleStatusChange(e.id, ev.target.value as ExtraStatus)}
              disabled={!!updatingId}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="IN_TREATMENT">בטיפול</option>
              <option value="REJECTED">נדחה</option>
              <option value="DONE">בוצע</option>
            </select>
          </div>
        </li>
      ))}
    </ul>
  );
}
