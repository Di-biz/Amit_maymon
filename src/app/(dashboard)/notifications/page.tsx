import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NotificationsList } from './NotificationsList';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">התראות</h1>
      <NotificationsList notifications={notifications ?? []} />
    </div>
  );
}
