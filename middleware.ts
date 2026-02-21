import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string };

const APP_PATHS = ['/cases', '/closure', '/approvals', '/extras', '/notifications'];

function isAppPath(pathname: string) {
  return APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (isPreview) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            response.cookies.set(name, value)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isAppPath(request.nextUrl.pathname) && !user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
