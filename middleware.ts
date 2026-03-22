import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware do Next.js — roda no Edge antes de cada request.
 * Detecta o hostname e passa como header para as páginas.
 * O ClanContext (client-side) usa window.location.hostname diretamente,
 * mas o middleware é útil para SSR e futuros metadados dinâmicos.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const response = NextResponse.next();
  response.headers.set('x-hostname', hostname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
