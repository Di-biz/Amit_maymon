import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NotificationsList } from './NotificationsList';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: notificationsData } = await supabase
    .from('notifications')
    .select('id, type, title, body, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (notificationsData ?? []) as {
    id: string;
    type: string | null;
    title: string;
    body: string | null;
    read: boolean;
    created_at: string;
  }[];
  const unreadCount = rows.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">התראות</h1>
          {unreadCount > 0 ? (
            <p className="text-sm text-indigo-600 font-medium mt-1">
              {unreadCount} התראות לא נקראו
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">הכל עדכני</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
            {rows.length} סה&quot;כ
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
              {unreadCount} חדשות
            </span>
          )}
        </div>
      </div>
      <NotificationsList notifications={rows} unreadCount={unreadCount} />
    </div>
  );
}
