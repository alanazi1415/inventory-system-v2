import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const category = searchParams.get('category') || 'all'

    const where: any = { system }

    // تصفية حسب التصنيف
    if (category === 'fast') {
      where.movementClass = { in: ['سريع جداً', 'سريع'] }
    } else if (category === 'slow') {
      where.movementClass = 'بطيء'
    } else if (category === 'no-movement') {
      where.movementClass = 'عديم الحركة'
    } else if (category !== 'all') {
      where.movementClass = category
    }

    // جلب جميع البنود بدون ترقيم صفحات
    const items = await db.itemMovement.findMany({
      where,
      orderBy: { movementScore: 'desc' }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات للتصدير' }, { status: 404 })
    }

    const systemName = system === 'hoz' ? 'هوز' : 'موصل'

    // تجهيز البيانات للإكسل
    const now = new Date()
    const excelData = items.map((item: any, index: number) => {
      let daysSinceLastDispatch: number | null = null
      if (item.lastDispatchDate) {
        const lastDispatch = new Date(item.lastDispatchDate)
        daysSinceLastDispatch = Math.ceil((now.getTime() - lastDispatch.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceLastDispatch < 0) daysSinceLastDispatch = 0
      }
      return {
        '#': index + 1,
        'رقم البند': item.genericItemNumber || '',
        'الوصف': item.description || '',
        'تصنيف الحركة': item.movementClass || '',
        'درجة الحركة': Math.round(item.movementScore || 0),
        'الكمية المصروفة': item.totalQtyDispatched || 0,
        'عدد المعاملات': item.transactionCount || 0,
        'متوسط الكمية لكل معاملة': Math.round(item.avgQtyPerTransaction || 0),
        'تاريخ أول صرف': item.firstDispatchDate 
          ? new Date(item.firstDispatchDate).toLocaleDateString('ar-SA') 
          : '',
        'تاريخ آخر صرف': item.lastDispatchDate 
          ? new Date(item.lastDispatchDate).toLocaleDateString('ar-SA') 
          : '',
        'منذ كم يوم': daysSinceLastDispatch ?? '',
        'الفترة (يوم)': item.daysSpan || 0,
        'تاريخ آخر تحليل': item.lastAnalysisDate 
          ? new Date(item.lastAnalysisDate).toLocaleDateString('ar-SA') 
          : '',
        'مصدر التقرير': item.reportSource || '',
        'النظام': systemName,
      }
    })

    // إنشاء ملف الإكسل
    const workbook = xlsx.utils.book_new()
    const worksheet = xlsx.utils.json_to_sheet(excelData)

    // تعيين عرض الأعمدة
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 18 },  // رقم البند
      { wch: 45 },  // الوصف
      { wch: 15 },  // تصنيف الحركة
      { wch: 12 },  // درجة الحركة
      { wch: 15 },  // الكمية المصروفة
      { wch: 12 },  // عدد المعاملات
      { wch: 18 },  // متوسط الكمية
      { wch: 15 },  // تاريخ أول صرف
      { wch: 15 },  // تاريخ آخر صرف
      { wch: 12 },  // منذ كم يوم
      { wch: 12 },  // الفترة
      { wch: 15 },  // تاريخ آخر تحليل
      { wch: 25 },  // مصدر التقرير
      { wch: 12 },  // النظام
    ]

    xlsx.utils.book_append_sheet(workbook, worksheet, 'تحليل الحركة')

    // إنشاء ملخص في ورقة منفصلة
    const classGroups = items.reduce((acc: any, item: any) => {
      const cls = item.movementClass || 'غير مصنف'
      if (!acc[cls]) acc[cls] = { count: 0, totalQty: 0, totalTx: 0 }
      acc[cls].count++
      acc[cls].totalQty += item.totalQtyDispatched || 0
      acc[cls].totalTx += item.transactionCount || 0
      return acc
    }, {})

    const summaryData = Object.entries(classGroups).map(([cls, data]: [string, any]) => ({
      'التصنيف': cls,
      'عدد البنود': data.count,
      'إجمالي الكمية المصروفة': data.totalQty,
      'إجمالي المعاملات': data.totalTx,
      'النسبة المئوية': `${((data.count / items.length) * 100).toFixed(1)}%`,
    }))

    const summarySheet = xlsx.utils.json_to_sheet(summaryData)
    summarySheet['!cols'] = [
      { wch: 15 },  // التصنيف
      { wch: 12 },  // عدد البنود
      { wch: 20 },  // إجمالي الكمية
      { wch: 15 },  // إجمالي المعاملات
      { wch: 15 },  // النسبة
    ]
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'ملخص التصنيفات')

    // إنشاء الملف
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // اسم الملف
    const categoryNames: Record<string, string> = {
      'all': 'تحليل_الحركة_الكامل',
      'fast': 'بنود_سريعة_الحركة',
      'slow': 'بنود_قليلة_الحركة',
      'no-movement': 'بنود_عديمة_الحركة',
      'سريع جداً': 'سريع_جداً',
      'سريع': 'سريع',
      'متوسط': 'متوسط',
      'بطيء': 'بطيء',
      'عديم الحركة': 'عديم_الحركة',
    }
    const categoryName = categoryNames[category] || category
    const date = new Date().toISOString().split('T')[0]
    const filename = `${systemName}_${categoryName}_${date}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })

  } catch (error: any) {
    console.error('Movement export error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تصدير تحليل الحركة', details: error.message }, { status: 500 })
  }
}
