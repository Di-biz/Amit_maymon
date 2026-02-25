import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { createMockSupabaseClient } from './mock-client';

const isPreview = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export function createClient() {
  if (isPreview) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
