import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * Debug DB Route - للتشخيص فقط
 * مُؤمّن: يتطلب صلاحية الأدمن
 */

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

export async function GET() {
  // منع الوصول في الإنتاج
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  
  // التحقق من الصلاحية
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
  }
  
  try {
    // اختبار الاتصال بقاعدة البيانات
    const userCount = await db.user.count()
    
    return NextResponse.json({
      status: 'connected',
      userCount,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Database debug error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'حدث خطأ في الاتصال',
      code: 'DB_CONNECTION_ERROR'
    }, { status: 500 })
  }
}
