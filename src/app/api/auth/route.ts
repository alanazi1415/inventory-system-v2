/**
 * Admin Authentication API - Enhanced Security
 * واجهة برمجة تطبيقات مصادقة الأدمن - محسنة أمنياً
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { 
  generateSessionToken, 
  calculateSessionExpiry, 
  isPasswordHashed,
  verifyPassword
} from '@/lib/auth'
import { 
  logLoginSuccess, 
  logLoginFailed, 
  logLogout,
  logSuspiciousActivity 
} from '@/lib/security/audit'
import { validateInput, detectSQLInjection } from '@/lib/security/validation'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// Rate limiting settings for auth
const AUTH_RATE_LIMIT = {
  limit: 5,           // 5 محاولات
  windowMs: 60000,    // خلال دقيقة واحدة
  blockDuration: 300  // حظر 5 دقائق
}

/**
 * الحصول على عنوان IP
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
 * تسجيل الدخول
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    // 1. Rate Limiting
    const rateLimitResult = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT)
    if (!rateLimitResult.success) {
      await logSuspiciousActivity(`Rate limit exceeded for auth attempts from ${ip}`, undefined)
      return rateLimitResponse(rateLimitResult)
    }
    
    // 2. Parse and validate input
    const body = await request.json()
    const { username, password } = body
    
    // التحقق من المدخلات
    const usernameValidation = validateInput(username, { 
      required: true, 
      minLength: 3, 
      maxLength: 50,
      checkSQL: true 
    })
    
    const passwordValidation = validateInput(password, { 
      required: true, 
      minLength: 1,
      maxLength: 128 
    })
    
    if (!usernameValidation.valid || !passwordValidation.valid) {
      await logLoginFailed(username || 'unknown', 'Invalid input')
      return NextResponse.json({ 
        error: 'بيانات الدخول غير صحيحة' 
      }, { status: 401 })
    }
    
    // 3. Get admin password from database (secure)
    let adminPassword: string
    
    try {
      const savedPassword = await db.$queryRaw<{ password: string }[]>`
        SELECT password FROM "AdminPassword" WHERE id = 'admin-password' LIMIT 1
      `
      
      if (savedPassword && savedPassword.length > 0) {
        adminPassword = savedPassword[0].password
      } else {
        // استخدام متغير البيئة إذا لم يكن هناك كلمة مرور في قاعدة البيانات
        adminPassword = process.env.ADMIN_PASSWORD || ''
        
        if (!adminPassword) {
          console.error('❌ ADMIN_PASSWORD not set in environment variables!')
          await logLoginFailed(username, 'Server configuration error')
          return NextResponse.json({ 
            error: 'خطأ في إعدادات الخادم' 
          }, { status: 500 })
        }
      }
    } catch (e) {
      // جدول AdminPassword غير موجود، استخدام متغير البيئة
      adminPassword = process.env.ADMIN_PASSWORD || ''
      
      if (!adminPassword) {
        console.error('❌ ADMIN_PASSWORD not set in environment variables!')
        await logLoginFailed(username, 'Server configuration error')
        return NextResponse.json({ 
          error: 'خطأ في إعدادات الخادم' 
        }, { status: 500 })
      }
    }
    
    // 4. Verify credentials
    let isAuthenticated = false
    
    // التحقق مما إذا كانت كلمة المرور مشفرة
    if (isPasswordHashed(adminPassword)) {
      // كلمة المرور مشفرة - استخدام bcrypt
      isAuthenticated = await verifyPassword(password, adminPassword)
    } else {
      // للتوافق مع الإصدارات القديمة - مقارنة مباشرة
      // ⚠️ تحذير: هذا يجب إزالته في الإصدار القادم
      if (username === 'admin' && password === adminPassword) {
        isAuthenticated = true
        
        // تشفير كلمة المرور وتحديثها في قاعدة البيانات
        const { hashPassword } = await import('@/lib/auth')
        const hashedPassword = await hashPassword(adminPassword)
        
        try {
          await db.$executeRaw`
            UPDATE "AdminPassword" 
            SET password = ${hashedPassword}, "updatedAt" = NOW() 
            WHERE id = 'admin-password'
          `
          console.log('✅ Password hashed and updated in database')
        } catch (updateError) {
          console.error('Failed to update hashed password:', updateError)
        }
      }
    }
    
    if (!isAuthenticated) {
      await logLoginFailed(username, 'Invalid credentials')
      return NextResponse.json({ 
        error: 'بيانات الدخول غير صحيحة' 
      }, { status: 401 })
    }
    
    // 5. Generate secure session token
    const token = generateSessionToken()
    const expiresAt = calculateSessionExpiry()
    
    // 6. Create session in database
    try {
      await db.adminSession.create({
        data: { token, expiresAt }
      })
    } catch (dbError) {
      console.error('Failed to create session:', dbError)
      await logLoginFailed(username, 'Database error')
      return NextResponse.json({ 
        error: 'حدث خطأ في إنشاء الجلسة' 
      }, { status: 500 })
    }
    
    // 7. Set secure cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/'
    })
    
    // 8. Log successful login
    await logLoginSuccess('admin', 'admin')
    
    return NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الدخول بنجاح'
    })
    
  } catch (error: any) {
    console.error('Auth error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء تسجيل الدخول' 
    }, { status: 500 })
  }
}

/**
 * تسجيل الخروج
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      // حذف الجلسة من قاعدة البيانات
      try {
        await db.adminSession.deleteMany({
          where: { token: session.value }
        })
      } catch (dbError) {
        console.log('DB Error during logout:', dbError)
      }
      
      // تسجيل الخروج
      await logLogout('admin', 'admin')
    }
    
    // حذف الكوكي
    cookieStore.delete('admin_session')
    
    return NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    })
  } catch (error: any) {
    console.error('Logout error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء تسجيل الخروج' 
    }, { status: 500 })
  }
}

/**
 * التحقق من حالة الجلسة
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return NextResponse.json({ 
          authenticated: true,
          expiresAt: adminSession.expiresAt.toISOString()
        })
      }
    }
    
    return NextResponse.json({ 
      authenticated: false 
    })
  } catch (error) {
    return NextResponse.json({ 
      authenticated: false 
    })
  }
}
