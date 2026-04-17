import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الوصول للـ Debug Route
async function isAuthorized(request: NextRequest): Promise<boolean> {
  // الطريقة 1: مفتاح سري في Header
  const authHeader = request.headers.get('x-debug-secret')
  if (authHeader === process.env.DEBUG_SECRET) {
    return true
  }

  // الطريقة 2: تحقق من Cookie (للمسؤولين المسجلين)
  try {
    const cookieStore = await import('next/headers').then(m => m.cookies())
    const cookies = await cookieStore
    return !!cookies.get('admin_session')?.value
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    // التحقق من الصلاحية
    if (!await isAuthorized(request)) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول', status: 401 },
        { status: 401 }
      )
    }

    // اختبار الاتصال بقاعدة البيانات (بدون كشف معلومات حساسة)
    const healthCheck = await db.$queryRaw`SELECT 1 as health`

    // إحصائيات عامة (بدون تفاصيل حساسة)
    const stats = {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }

    return NextResponse.json(stats)

  } catch (error: any) {
    // لا نكشف Stack Trace في الإنتاج
    console.error('Debug error:', error.message)
    return NextResponse.json(
      {
        status: 'error',
        message: 'حدث خطأ في الاتصال',
        code: 'DB_CONNECTION_ERROR'
      },
      { status: 500 }
    )
  }
}
