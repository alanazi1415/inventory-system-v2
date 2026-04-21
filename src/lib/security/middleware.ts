/**
 * Security Middleware
 * وسيط الأمان لحماية الـ APIs
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { logSuspiciousActivity, logUnauthorizedAccess, logRateLimitExceeded } from './audit'
import { generateSecureToken } from './crypto'

// إعدادات Rate Limiting لكل مسار
const RATE_LIMIT_CONFIGS: Record<string, { limit: number; windowMs: number; blockDuration: number }> = {
  '/api/auth': { limit: 5, windowMs: 60000, blockDuration: 300 },        // 5 محاولات/دقيقة
  '/api/user-auth': { limit: 5, windowMs: 60000, blockDuration: 300 },   // 5 محاولات/دقيقة
  '/api/upload': { limit: 10, windowMs: 60000, blockDuration: 300 },     // 10 رفعات/دقيقة
  '/api/export': { limit: 20, windowMs: 60000, blockDuration: 60 },      // 20 تصدير/دقيقة
  '/api/users': { limit: 30, windowMs: 60000, blockDuration: 60 },       // 30 طلب/دقيقة
  'default': { limit: 100, windowMs: 60000, blockDuration: 60 }          // 100 طلب/دقيقة
}

// المسارات المحمية (تتطلب مصادقة)
const PROTECTED_PATHS = [
  '/api/inventory',
  '/api/users',
  '/api/upload',
  '/api/export',
  '/api/movement',
  '/api/alternatives',
  '/api/delivery-schedule',
  '/api/stats',
  '/api/admin'
]

// المسارات العامة (لا تتطلب مصادقة)
const PUBLIC_PATHS = [
  '/api/auth',
  '/api/user-auth',
  '/api/visitor',
  '/api/health'
]

// مسارات الأدمن فقط
const ADMIN_ONLY_PATHS = [
  '/api/users',
  '/api/admin',
  '/api/create-tables'
]

/**
 * الحصول على عنوان IP الحقيقي
 */
function getRealIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  return 'unknown'
}

/**
 * الحصول على إعدادات Rate Limit للمسار
 */
function getRateLimitConfig(path: string) {
  for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (path.startsWith(key)) {
      return config
    }
  }
  return RATE_LIMIT_CONFIGS.default
}

/**
 * التحقق من CSRF Token
 */
function verifyCSRFToken(request: NextRequest): boolean {
  // تجاوز التحقق للطرق الآمنة
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true
  }
  
  // التحقق من Origin header
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  
  if (origin && host) {
    const originHost = origin.replace(/^https?:\/\//, '')
    if (originHost !== host) {
      return false
    }
  }
  
  // التحقق من CSRF token في الـ headers
  const csrfToken = request.headers.get('x-csrf-token')
  const cookieToken = request.cookies.get('csrf_token')?.value
  
  if (csrfToken && cookieToken) {
    return csrfToken === cookieToken
  }
  
  // السماح إذا لم يكن هناك token (للتوافق مع النظام الحالي)
  return true
}

/**
 * التحقق من Content-Type
 */
function verifyContentType(request: NextRequest): boolean {
  // تجاوز للطرق التي لا تحتوي على body
  if (['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(request.method)) {
    return true
  }
  
  const contentType = request.headers.get('content-type')
  
  // السماح بـ JSON و FormData
  if (contentType) {
    const allowedTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded'
    ]
    return allowedTypes.some(type => contentType.includes(type))
  }
  
  return true
}

/**
 * التحقق من User-Agent
 */
function verifyUserAgent(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent')
  
  if (!userAgent) {
    return false
  }
  
  // حظر الـ bots المشبوهة
  const blockedPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i,
    /gobuster/i,
    /dirbuster/i,
    /wpscan/i,
    /burpsuite/i,
    /metasploit/i
  ]
  
  return !blockedPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * إضافة Security Headers
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // منع clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // منع MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // تفعيل XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy (أساسي)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  )
  
  return response
}

/**
 * الوسيط الأمني الرئيسي
 */
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname
  const method = request.method
  const ip = getRealIP(request)
  
  // 1. التحقق من User-Agent
  if (!verifyUserAgent(request)) {
    await logSuspiciousActivity(`Blocked suspicious User-Agent from ${ip}`, undefined)
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  
  // 2. Rate Limiting
  const rateLimitConfig = getRateLimitConfig(path)
  const rateLimitResult = checkRateLimit(`ip:${ip}`, rateLimitConfig)
  
  if (!rateLimitResult.success) {
    console.warn(`Rate limit exceeded for IP: ${ip} on ${path}`)
    return rateLimitResponse(rateLimitResult)
  }
  
  // 3. التحقق من CSRF (للطرق غير الآمنة)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !verifyCSRFToken(request)) {
    await logSuspiciousActivity(`CSRF violation from ${ip} on ${path}`, undefined)
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }
  
  // 4. التحقق من Content-Type
  if (!verifyContentType(request)) {
    return NextResponse.json({ error: 'Invalid Content-Type' }, { status: 415 })
  }
  
  // 5. التحقق من حجم الطلب
  const contentLength = parseInt(request.headers.get('content-length') || '0')
  const MAX_CONTENT_LENGTH = 50 * 1024 * 1024 // 50MB
  
  if (contentLength > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  
  // إذا وصلنا هنا، فالطلب آمن ويُسمح بالمرور
  return null
}

/**
 * إنشاء response مع security headers
 */
export function secureResponse(response: NextResponse): NextResponse {
  return addSecurityHeaders(response)
}

/**
 * إنشاء CSRF token
 */
export function createCSRFToken(): { token: string; cookieValue: string } {
  const token = generateSecureToken(32)
  const cookieValue = generateSecureToken(32)
  return { token, cookieValue }
}

/**
 * التحقق من صلاحيات المستخدم للمسار
 */
export function checkPathPermission(
  userRole: 'admin' | 'user',
  path: string,
  method: string
): boolean {
  // المسارات العامة
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return true
  }
  
  // مسارات الأدمن فقط
  if (ADMIN_ONLY_PATHS.some(p => path.startsWith(p))) {
    return userRole === 'admin'
  }
  
  // المسارات المحمية تتطلب مستخدم مسجل
  if (PROTECTED_PATHS.some(p => path.startsWith(p))) {
    return !!userRole
  }
  
  // السماح بالباقي
  return true
}

/**
 * الحصول على معرف الجلسة من الكوكيز
 */
export function getSessionFromCookies(request: NextRequest): {
  adminSession?: string
  userSession?: string
} {
  return {
    adminSession: request.cookies.get('admin_session')?.value,
    userSession: request.cookies.get('user_session')?.value
  }
}
