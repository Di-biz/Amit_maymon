'use server';

import { createClient } from '@/lib/supabase/server';

export async function markRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  const { error } = await supabase
    .from('notifications')
    .update({ read: true } as never)
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  await supabase.from('notifications').update({ read: true } as never).eq('user_id', user.id).eq('read', false);
  return { ok: true };
}
