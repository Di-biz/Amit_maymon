import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ExtrasMinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  if (!isPreview && profile?.role !== 'PAINTER') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">התוספות שלי</h1>
        <p className="text-gray-500">אין גישה לדף זה.</p>
      </div>
    );
  }

  const { data: extras } = await supabase
    .from('bodywork_extras')
    .select(`
      id,
      description,
      status,
      created_at,
      cases(case_key, cars(license_plate))
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  const list = (extras ?? []).map((r) => {
    const row = r as {
      id: string;
      description: string;
      status: string;
      created_at: string;
      cases: { case_key: string | null; cars: { license_plate: string | null } | null } | null;
    };
    const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    const car = c && (Array.isArray(c.cars) ? c.cars[0] : c.cars);
    return {
      id: row.id,
      description: row.description,
      status: row.status,
      created_at: row.created_at,
      case_key: c?.case_key ?? '—',
      plate: car?.license_plate ?? '—',
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">התוספות שלי</h1>
      <ul className="border rounded bg-white divide-y">
        {list.length === 0 ? (
          <li className="p-4 text-gray-500">אין תוספות</li>
        ) : (
          list.map((e) => (
            <li key={e.id} className="p-4">
              <p className="font-medium">{e.description}</p>
              <p className="text-sm text-gray-500">
                תיק: {e.case_key} — {e.plate} | סטטוס: {e.status} |{' '}
                {new Date(e.created_at).toLocaleDateString('he-IL')}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
