'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { decideApproval } from '@/app/actions/approvals';

interface ApprovalRow {
  id: string;
  case_id: string;
  approval_type: string;
  rejection_note: string | null;
  case_key: string | null;
  fixcar_link: string | null;
  parts_status: string | null;
  plate: string;
  branch_name: string;
}

export function ApprovalsList({ approvals }: { approvals: ApprovalRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = approvals.find((a) => a.id === selectedId);

  async function handleApprove(approvalId: string) {
    setError(null);
    setLoading(true);
    const res = await decideApproval({ approval_id: approvalId, status: 'APPROVED' });
    setLoading(false);
    if (res?.error) setError(res.error);
    else {
      setSelectedId(null);
      router.refresh();
    }
  }

  async function handleReject(approvalId: string) {
    setError(null);
    setLoading(true);
    const res = await decideApproval({
      approval_id: approvalId,
      status: 'REJECTED',
      rejection_note: rejectNote,
    });
    setLoading(false);
    if (res?.error) setError(res.error);
    else {
      setSelectedId(null);
      setRejectNote('');
      router.refresh();
    }
  }

  if (approvals.length === 0) {
    return <p className="text-gray-500">אין אישורים ממתינים</p>;
  }

  return (
    <div className="flex gap-4">
      <ul className="w-80 border rounded bg-white divide-y max-h-96 overflow-y-auto">
        {approvals.map((a) => (
          <li
            key={a.id}
            className={`p-3 cursor-pointer ${selectedId === a.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => setSelectedId(a.id)}
          >
            <span className="font-medium">{a.case_key ?? a.plate}</span>
            <span className="text-gray-500 text-sm block">{a.approval_type}</span>
          </li>
        ))}
      </ul>
      <div className="flex-1 bg-white border rounded p-4">
        {selected ? (
          <>
            <h3 className="font-bold mb-2">פרטי תיק</h3>
            <div className="text-sm space-y-1 mb-4">
              <p>תיק: {selected.case_key ?? selected.plate}</p>
              <p>רישוי: {selected.plate}</p>
              <p>סניף: {selected.branch_name}</p>
              <p>חלקים: {selected.parts_status ?? '—'}</p>
              {selected.fixcar_link && (
                <a
                  href={selected.fixcar_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  קישור FixCar
                </a>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleApprove(selected.id)}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50"
              >
                אשר
              </button>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="הערה לדחייה"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-48"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleReject(selected.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  דחה
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </>
        ) : (
          <p className="text-gray-500">בחר אישור מהרשימה</p>
        )}
      </div>
    </div>
  );
}
