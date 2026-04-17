/**
 * Rate Limiting Utility
 * يحمي API routes من الطلبات الكثيرة
 */

interface RateLimitEntry {
  timestamps: number[]
  blocked: boolean
  blockedUntil: number | null
}

// تخزين الطلبات (في الذاكرة - للاستخدام المؤقت)
// في الإنتاج، يُفضل استخدام Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// تنظيف تلقائي كل 5 دقائق
const CLEANUP_INTERVAL = 5 * 60 * 1000
const MAX_ENTRIES = 10000

// تنظيف الإدخالات القديمة
function cleanup() {
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000

  for (const [key, entry] of rateLimitStore.entries()) {
    // حذف الإدخالات القديمة
    entry.timestamps = entry.timestamps.filter(t => t > oneHourAgo)

    // إلغاء الحظر إذا انتهت المدة
    if (entry.blockedUntil && entry.blockedUntil < now) {
      entry.blocked = false
      entry.blockedUntil = null
    }

    // حذف إذا لم يعد هناك بيانات
    if (entry.timestamps.length === 0 && !entry.blocked) {
      rateLimitStore.delete(key)
    }
  }

  // حذف إذا تجاوزنا الحد الأقصى
  if (rateLimitStore.size > MAX_ENTRIES) {
    const entries = Array.from(rateLimitStore.entries())
    entries.slice(0, entries.length - MAX_ENTRIES).forEach(([key]) => {
      rateLimitStore.delete(key)
    })
  }
}

// بدء التنظيف التلقائي
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, CLEANUP_INTERVAL)
}

export interface RateLimitConfig {
  /** عدد الطلبات المسموح بها */
  limit: number
  /** نافذة الوقت بالميلي ثانية (افتراضي: دقيقة واحدة) */
  windowMs?: number
  /** مدة الحظر بالثواني (افتراضي: 60 ثانية) */
  blockDuration?: number
}

export interface RateLimitResult {
  /** هل تم السماح بالطلب */
  success: boolean
  /** عدد الطلبات المتبقية */
  remaining: number
  /** متى يُعاد السماح (إذا كان محظوراً) */
  resetAt: number | null
  /** عدد الثواني المتبقية للحظر */
  retryAfter: number | null
}

/**
 * التحقق من Rate Limit لعنوان IP
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 100, windowMs: 60000, blockDuration: 60 }
): RateLimitResult {
  const { limit, windowMs = 60000, blockDuration = 60 } = config
  const now = Date.now()
  const windowStart = now - windowMs

  // الحصول على أو إنشاء إدخال
  let entry = rateLimitStore.get(identifier)

  if (!entry) {
    entry = { timestamps: [], blocked: false, blockedUntil: null }
    rateLimitStore.set(identifier, entry)
  }

  // التحقق إذا كان محظوراً
  if (entry.blocked && entry.blockedUntil) {
    if (entry.blockedUntil > now) {
      return {
        success: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
      }
    } else {
      // إلغاء الحظر
      entry.blocked = false
      entry.blockedUntil = null
    }
  }

  // تصفية الطلبات القديمة
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  // التحقق من الحد
  if (entry.timestamps.length >= limit) {
    // حساب وقت إعادة المحاولة
    const oldestTimestamp = Math.min(...entry.timestamps)
    const resetAt = oldestTimestamp + windowMs
    const retryAfter = Math.ceil((resetAt - now) / 1000)

    // التحقق إذا كان هذا هو المرة الثالثة التي يتم تجاوز الحد فيها
    // لفرض حظر مؤقت
    const recentViolations = entry.timestamps.filter(
      t => t > now - windowMs * 3
    ).length

    if (recentViolations >= limit * 2) {
      entry.blocked = true
      entry.blockedUntil = now + blockDuration * 1000

      return {
        success: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: blockDuration
      }
    }

    return {
      success: false,
      remaining: 0,
      resetAt,
      retryAfter
    }
  }

  // تسجيل الطلب
  entry.timestamps.push(now)

  return {
    success: true,
    remaining: limit - entry.timestamps.length,
    resetAt: now + windowMs,
    retryAfter: null
  }
}

/**
 * Middleware للتحقق من Rate Limit
 * يستخدم في API routes
 */
export function rateLimitMiddleware(config: RateLimitConfig = { limit: 100 }) {
  return function getIdentifier(request: Request): string {
    // الحصول على IP من Headers المختلفة
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
}

/**
 * إنشاء Response مناسب لـ Rate Limit exceeded
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const headers = new Headers()
  headers.set('X-RateLimit-Remaining', result.remaining.toString())

  if (result.resetAt) {
    headers.set('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString())
  }

  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString())
    return new Response(
      JSON.stringify({
        error: 'تم تجاوز الحد المسموح من الطلبات',
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(headers.entries())
        }
      }
    )
  }

  return new Response(
    JSON.stringify({ error: 'تم تجاوز الحد المسموح من الطلبات' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(headers.entries())
      }
    }
  )
}
