import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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
  
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
  }
  
  try {
    // جلب عينة محدودة
    const allItems = await db.itemMovement.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    // إحصائيات حسب النظام
    const bySystem = await db.itemMovement.groupBy({
      by: ['system'],
      _count: { id: true }
    })

    // إجمالي العدد
    const total = await db.itemMovement.count()

    // آخر التقارير
    const reports = await db.movementReportLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      total,
      bySystem,
      recentItems: allItems,
      recentReports: reports,
      message: allItems.length === 0 
        ? '⚠️ لا توجد بيانات - قم برفع تقرير الحركة'
        : `✅ يوجد ${total} بند في قاعدة البيانات`
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: 'حدث خطأ',
      code: 'QUERY_ERROR'
    }, { status: 500 })
  }
}
