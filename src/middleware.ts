import { type NextRequest } from 'next/server'
import { proxy } from '@/utils/supabase/proxy'

export async function middleware(request: NextRequest) {
  // Chiama la logica di Supabase definita nel file delle utility
  return await proxy(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}