import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * Debug Route - للتشخيص فقط
 * مُؤمّن: يتطلب صلاحية الأدمن
 */

// التحقق من صلاحية الأدمن
async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (!session?.value) return false
    
    const adminSession = await db.adminSession.findUnique({
      where: { token: session.value }
    })
    
    return !!(adminSession && adminSession.expiresAt > new Date())
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  // منع الوصول في الإنتاج
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }
  
  // التحقق من الصلاحية
  if (!await checkAdminAuth()) {
    return NextResponse.json(
      { error: 'غير مصرح بالوصول' },
      { status: 401 }
    )
  }

  try {
    // اختبار الاتصال بقاعدة البيانات
    await db.$queryRaw`SELECT 1 as health`

    // إحصائيات عامة (آمنة)
    const stats = {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    }

    return NextResponse.json(stats)

  } catch (error: any) {
    // لا نكشف تفاصيل الخطأ
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
