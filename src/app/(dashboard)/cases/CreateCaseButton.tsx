'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCase } from '@/app/actions/workflow';
import type { InsuranceType, ClaimType } from '@/types/database';

interface Branch {
  id: string;
  name: string;
}

export function CreateCaseButton({
  branchId,
  branches = [],
  isCeo = false,
}: {
  branchId: string | null;
  branches?: Branch[];
  isCeo?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    plate_number: '',
    claim_number: '',
    first_registration_date: '',
    insurance_type: '' as InsuranceType | '',
    claim_type: '' as ClaimType | '',
    branch_id: branchId ?? (branches[0]?.id ?? ''),
  });

  function generateRandomValues() {
    // Generate random plate number (Israeli format: 2-3 digits, 2-3 letters, 1-2 digits)
    const digits1 = Math.floor(Math.random() * 90) + 10; // 10-99
    const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];
    const letter1 = letters[Math.floor(Math.random() * letters.length)];
    const letter2 = letters[Math.floor(Math.random() * letters.length)];
    const digits2 = Math.floor(Math.random() * 90) + 10; // 10-99
    const plate_number = `${digits1}${letter1}${letter2}${digits2}`;
    
    // Generate random claim number
    const claim_number = `CLM-${Math.floor(Math.random() * 90000) + 10000}`;
    
    // Generate random registration date (between 0-15 years ago)
    const yearsAgo = Math.floor(Math.random() * 16);
    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - yearsAgo);
    const first_registration_date = registrationDate.toISOString().split('T')[0];
    
    // Random insurance type
    const insuranceTypes: InsuranceType[] = ['COMPREHENSIVE', 'THIRD_PARTY', 'PRIVATE', 'OTHER'];
    const insurance_type = insuranceTypes[Math.floor(Math.random() * insuranceTypes.length)] as InsuranceType;
    
    // Random claim type
    const claimTypes: ClaimType[] = ['PRIVATE', 'ACCIDENT', 'FLOOD'];
    const claim_type = claimTypes[Math.floor(Math.random() * claimTypes.length)] as ClaimType;
    
    return {
      plate_number,
      claim_number,
      first_registration_date,
      insurance_type,
      claim_type,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createCase({
      plate_number: form.plate_number.trim(),
      claim_number: form.claim_number.trim() || null,
      first_registration_date: form.first_registration_date,
      insurance_type: form.insurance_type || null,
      claim_type: form.claim_type || null,
      branch_id: form.branch_id,
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    
    // Get the caseId from the response
    const newCaseId = res?.caseId;
    
    setOpen(false);
    setForm({
      plate_number: '',
      claim_number: '',
      first_registration_date: '',
      insurance_type: '',
      claim_type: '',
      branch_id: branchId ?? branches[0]?.id ?? '',
    });
    
    // Refresh the cases page to show the new case
    // In PREVIEW mode, the case might not be immediately available, so we just refresh
    router.push('/cases');
    router.refresh();
  }

  async function handleRandomSubmit() {
    setError(null);
    setLoading(true);
    const randomValues = generateRandomValues();
    const res = await createCase({
      plate_number: randomValues.plate_number,
      claim_number: randomValues.claim_number,
      first_registration_date: randomValues.first_registration_date,
      insurance_type: randomValues.insurance_type,
      claim_type: randomValues.claim_type,
      branch_id: branchId ?? branches[0]?.id ?? '',
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    
    // Refresh the cases page to show the new case
    router.push('/cases');
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          פתיחת תיק
        </button>
        <button
          type="button"
          onClick={handleRandomSubmit}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
          title="יוצר תיק חדש עם ערכים רנדומליים"
        >
          {loading ? 'יוצר...' : '🎲 תיק רנדומלי'}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">פתיחת תיק חדש</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">מספר רישוי *</label>
                <input
                  type="text"
                  required
                  value={form.plate_number}
                  onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">מספר תביעה</label>
                <input
                  type="text"
                  value={form.claim_number}
                  onChange={(e) => setForm((f) => ({ ...f, claim_number: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">תאריך עלייה לכביש *</label>
                <input
                  type="date"
                  required
                  value={form.first_registration_date}
                  onChange={(e) => setForm((f) => ({ ...f, first_registration_date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">סוג ביטוח</label>
                <select
                  value={form.insurance_type}
                  onChange={(e) => setForm((f) => ({ ...f, insurance_type: e.target.value as InsuranceType }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="COMPREHENSIVE">מקיף</option>
                  <option value="THIRD_PARTY">צד ג׳</option>
                  <option value="PRIVATE">פרטי</option>
                  <option value="OTHER">אחר</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">סוג תביעה</label>
                <select
                  value={form.claim_type}
                  onChange={(e) => setForm((f) => ({ ...f, claim_type: e.target.value as ClaimType }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="PRIVATE">פרטי</option>
                  <option value="ACCIDENT">תאונה</option>
                  <option value="FLOOD">הצפה</option>
                </select>
              </div>
              {isCeo && branches.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">סניף</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 border rounded text-sm"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {loading ? 'יוצר...' : 'צור תיק'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
