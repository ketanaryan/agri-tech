import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Basic CSRF Protection for API routes (POST, PUT, DELETE, PATCH)
  if (request.nextUrl.pathname.startsWith('/api/') && !['GET', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // If an Origin header is present, ensure it matches the Host header.
    // Next.js Server Actions already do this inherently, but API routes need it manually.
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        // Note: host may contain port (e.g., localhost:3000)
        if (originUrl.host !== host) {
          return NextResponse.json({ error: 'CSRF validation failed: Origin mismatch' }, { status: 403 });
        }
      } catch (e) {
        return NextResponse.json({ error: 'CSRF validation failed: Invalid Origin' }, { status: 403 });
      }
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/auth')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isPublicRoute && request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
