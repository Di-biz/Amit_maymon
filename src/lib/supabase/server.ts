import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { createMockSupabaseClient } from './mock-client';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export async function createClient() {
  if (isPreview) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component; ignore.
          }
        },
      },
    }
  );
}
