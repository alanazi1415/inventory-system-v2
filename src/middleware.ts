/**
 * Next.js Middleware - Security Layer
 * طبقة الأمان لجميع الطلبات
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// IP addresses to block (can be loaded from database)
const BLOCKED_IPS = new Set<string>()

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth',
  '/api/user-auth',
  '/api/visitor',
  '/api/health',
  '/login',
  '/_next',
  '/favicon.ico',
  '/robots.txt'
]

// Paths that require admin role
const ADMIN_PATHS = [
  '/api/users',
  '/api/admin',
  '/api/create-tables',
  '/api/debug'
]

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  if (cfConnectingIp) return cfConnectingIp
  return 'unknown'
}

/**
 * Check if path is public
 */
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(p => path.startsWith(p))
}

/**
 * Check if path requires admin
 */
function isAdminPath(path: string): boolean {
  return ADMIN_PATHS.some(p => path.startsWith(p))
}

/**
 * Security middleware
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const ip = getClientIP(request)
  
  // 1. Block blacklisted IPs
  if (BLOCKED_IPS.has(ip)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  
  // 2. Add security headers to all responses
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // 3. Check authentication for protected API routes
  if (path.startsWith('/api/') && !isPublicPath(path)) {
    const adminSession = request.cookies.get('admin_session')?.value
    const userSession = request.cookies.get('user_session')?.value
    
    if (!adminSession && !userSession) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    
    // Check admin-only paths
    if (isAdminPath(path) && !adminSession) {
      return NextResponse.json(
        { error: 'هذه الميزة متاحة للمسؤول فقط', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
  }
  
  // 4. Add request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  response.headers.set('X-Request-ID', requestId)
  
  return response
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
