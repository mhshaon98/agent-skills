import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = ['/notes', '/account'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          response.cookies.set({ name, value: '', ...options })
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const needsAuth = PROTECTED.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (needsAuth && !user) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/notes/:path*', '/account/:path*']
};
