import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // جلب جميع البيانات بدون فلترة
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
        ? '⚠️ لا توجد بيانات في جدول ItemMovement - قم برفع تقرير الحركة'
        : `✅ يوجد ${total} بند في قاعدة البيانات`
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: error.message,
      hint: 'قد يكون جدول ItemMovement غير موجود - شغل /api/fix-all أولاً'
    }, { status: 500 })
  }
}
