import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const urgency = searchParams.get('urgency') || 'all'

    const where: any = { system }
    if (urgency !== 'all') {
      where.urgencyLevel = urgency
    }

    // جلب الاقتراحات
    const suggestions = await db.topUpSuggestion.findMany({
      where,
      orderBy: [
        { urgencyLevel: 'asc' },
        { daysOfStock: 'asc' }
      ]
    })

    if (suggestions.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات للتصدير' }, { status: 404 })
    }

    // جلب معلومات المخزون للحصول على Trade Code
    const inventoryItems = await db.inventoryItem.findMany({
      where: { system },
      select: {
        genericItemNumber: true,
        tradeItemNumber: true,
        customerItemNumber: true,
        genericItemDescription: true
      }
    })

    // إنشاء خريطة للأكواد التجارية
    const tradeCodeMap = new Map<string, { tradeCode: string | null; customerCode: string | null }>()
    for (const item of inventoryItems) {
      if (item.genericItemNumber) {
        if (!tradeCodeMap.has(item.genericItemNumber)) {
          tradeCodeMap.set(item.genericItemNumber, {
            tradeCode: item.tradeItemNumber,
            customerCode: item.customerItemNumber
          })
        }
      }
    }

    const systemName = system === 'hoz' ? 'هوز' : 'موصل'

    // تجهيز البيانات للإكسل
    const excelData = suggestions.map((item, index) => {
      const codes = tradeCodeMap.get(item.genericItemNumber) || { tradeCode: null, customerCode: null }
      return {
        '#': index + 1,
        'رقم البند الرئيسي': item.genericItemNumber || '',
        'الكود التجاري (Trade Code)': codes.tradeCode || '',
        'كود العميل': codes.customerCode || '',
        'الوصف': item.description || '',
        'المخزون الحالي': item.currentStock || 0,
        'المخزون المتاح': item.availableStock || 0,
        'متوسط الاستهلاك اليومي': Number((item.avgDailyConsumption || 0).toFixed(2)),
        'أيام المخزون المتبقية': Number((item.daysOfStock || 0).toFixed(1)),
        'مستوى الإلحاح': item.urgencyLevel || '',
        'الكمية المقترحة للتغذية': Math.ceil(item.suggestedQty || 0),
        'فترة التحليل (يوم)': item.analysisPeriodDays || 90,
        'تاريخ الحساب': item.calculationDate
          ? new Date(item.calculationDate).toLocaleDateString('ar-SA')
          : '',
        'المستودع': systemName,
      }
    })

    // إنشاء ملف الإكسل
    const workbook = xlsx.utils.book_new()
    const worksheet = xlsx.utils.json_to_sheet(excelData)

    // تعيين عرض الأعمدة
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 18 },  // رقم البند الرئيسي
      { wch: 18 },  // الكود التجاري
      { wch: 18 },  // كود العميل
      { wch: 45 },  // الوصف
      { wch: 15 },  // المخزون الحالي
      { wch: 15 },  // المخزون المتاح
      { wch: 20 },  // متوسط الاستهلاك
      { wch: 18 },  // أيام المخزون
      { wch: 12 },  // مستوى الإلحاح
      { wch: 20 },  // الكمية المقترحة
      { wch: 15 },  // فترة التحليل
      { wch: 15 },  // تاريخ الحساب
      { wch: 12 },  // المستودع
    ]

    xlsx.utils.book_append_sheet(workbook, worksheet, 'اقتراحات التغذية')

    // إنشاء ملخص في ورقة منفصلة
    const urgencyGroups = suggestions.reduce((acc: any, item) => {
      const level = item.urgencyLevel || 'غير محدد'
      if (!acc[level]) acc[level] = { count: 0, totalSuggested: 0, totalStock: 0 }
      acc[level].count++
      acc[level].totalSuggested += item.suggestedQty || 0
      acc[level].totalStock += item.availableStock || 0
      return acc
    }, {})

    const summaryData = Object.entries(urgencyGroups).map(([level, data]: [string, any]) => ({
      'مستوى الإلحاح': level,
      'عدد البنود': data.count,
      'إجمالي المخزون المتاح': data.totalStock,
      'إجمالي الكمية المقترحة': Math.ceil(data.totalSuggested),
      'النسبة المئوية': `${((data.count / suggestions.length) * 100).toFixed(1)}%`,
    }))

    const summarySheet = xlsx.utils.json_to_sheet(summaryData)
    summarySheet['!cols'] = [
      { wch: 15 },  // مستوى الإلحاح
      { wch: 12 },  // عدد البنود
      { wch: 20 },  // إجمالي المخزون
      { wch: 20 },  // إجمالي الكمية المقترحة
      { wch: 15 },  // النسبة
    ]
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'ملخص')

    // إنشاء الملف
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // اسم الملف
    const urgencyNames: Record<string, string> = {
      'all': 'اقتراحات_التغذية_الكاملة',
      'حرج': 'اقتراحات_حرجة',
      'عالي': 'اقتراحات_عالية_الإلحاح',
      'متوسط': 'اقتراحات_متوسطة',
      'منخفض': 'اقتراحات_منخفضة',
    }
    const urgencyName = urgencyNames[urgency] || urgency
    const date = new Date().toISOString().split('T')[0]
    const filename = `${systemName}_${urgencyName}_${date}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })

  } catch (error: any) {
    console.error('TOP UP export error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تصدير الاقتراحات', details: error.message }, { status: 500 })
  }
}
