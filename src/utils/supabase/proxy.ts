import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

// In Next.js 16, la funzione deve chiamarsi 'proxy' nel file 'proxy.ts'
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}