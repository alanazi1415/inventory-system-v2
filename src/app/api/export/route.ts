import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'hoz'
    const category = searchParams.get('category') || 'all'

    // التحقق من الأعمدة الجديدة
    try {
      await db.$executeRaw`SELECT "isSmoking", "isKidney", "isCentral" FROM "InventoryItem" LIMIT 1`
    } catch {
      console.log('Adding new columns...')
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSmoking" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isKidney" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isCentral" BOOLEAN NOT NULL DEFAULT false`
    }

    // Build where clause - دائماً استبعاد البنود المنتهية
    const where: any = { 
      system,
      daysToExpire: { gt: 0 }
    }

    switch (category) {
      case 'all':
        // البنود المنتهية مستثناة بالفعل
        break
      case 'expired':
        // لا نريد تصدير البنود المنتهية
        where.daysToExpire = { lte: 0 }
        break
      case 'expiring':
        where.daysToExpire = { gt: 0, lte: 90 }
        break
      case 'hold':
        where.holdQty = { gt: 0 }
        break
      case 'life_saving':
        where.isLifeSaving = true
        break
      case 'narcotic':
        where.isNarcotic = true
        break
      case 'vaccine':
        where.isVaccine = true
        break
      case 'strategic':
        where.isStrategic = true
        break
      case 'smoking':
        where.isSmoking = true
        break
      case 'kidney':
        where.isKidney = true
        break
      case 'central':
        where.isCentral = true
        break
    }

    // Fetch all items (no pagination for export)
    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { daysToExpire: 'asc' }
    })

    // Prepare data for Excel
    const excelData = items.map((item: any, index) => ({
      '#': index + 1,
      'رقم نوبكو': item.genericItemNumber || '',
      'الوصف': item.genericItemDescription || '',
      'رقم الوزاري': item.customerItemNumber || '',
      'تريد كود': item.tradeItemNumber || '',
      'الكمية الإجمالية': item.totalQty,
      'الكمية المتاحة': item.availableQty,
      'كمية Hold': item.holdQty,
      'سبب Hold': item.holdType || '',
      'تاريخ الانتهاء': item.expiryDate || '',
      'الأيام المتبقية': Math.round(item.daysToExpire),
      'الحالة': item.daysToExpire <= 0 ? 'منتهي' : 
                 item.daysToExpire <= 30 ? 'خطر - أقل من شهر' :
                 item.daysToExpire <= 90 ? 'تحذير - أقل من 3 أشهر' :
                 item.daysToExpire <= 180 ? 'انتباه - أقل من 6 أشهر' : 'سليم',
      'منقذ للحياة': item.isLifeSaving ? 'نعم' : 'لا',
      'مخدر': item.isNarcotic ? 'نعم' : 'لا',
      'لقاح': item.isVaccine ? 'نعم' : 'لا',
      'استراتيجي': item.isStrategic ? 'نعم' : 'لا',
      'تدخين': item.isSmoking ? 'نعم' : 'لا',
      'كلى': item.isKidney ? 'نعم' : 'لا',
      'مركزي': item.isCentral ? 'نعم' : 'لا',
    }))

    // Create workbook
    const workbook = xlsx.utils.book_new()
    const worksheet = xlsx.utils.json_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 15 },  // رقم نوبكو
      { wch: 40 },  // الوصف
      { wch: 15 },  // رقم الوزاري
      { wch: 15 },  // تريد كود
      { wch: 12 },  // الكمية الإجمالية
      { wch: 12 },  // الكمية المتاحة
      { wch: 10 },  // كمية Hold
      { wch: 25 },  // سبب Hold
      { wch: 12 },  // تاريخ الانتهاء
      { wch: 12 },  // الأيام المتبقية
      { wch: 20 },  // الحالة
      { wch: 12 },  // منقذ للحياة
      { wch: 10 },  // مخدر
      { wch: 10 },  // لقاح
      { wch: 12 },  // استراتيجي
      { wch: 10 },  // تدخين
      { wch: 10 },  // كلى
      { wch: 10 },  // مركزي
    ]

    xlsx.utils.book_append_sheet(workbook, worksheet, 'المخزون')

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Generate filename
    const categoryNames: Record<string, string> = {
      'all': 'كل_المخزون',
      'expired': 'البنود_المنتهية',
      'expiring': 'قاربت_على_الانتهاء',
      'hold': 'البنود_عليها_Hold',
      'life_saving': 'البنود_المنقذة_للحياة',
      'narcotic': 'المخدرات',
      'vaccine': 'اللقاحات',
      'strategic': 'البنود_الاستراتيجية',
      'smoking': 'بنود_التدخين',
      'kidney': 'بنود_الكلى',
      'central': 'البنود_المركزية',
    }
    const systemName = system === 'hoz' ? 'هوز' : 'موصول'
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
    console.error('Export error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التصدير', details: error.message }, { status: 500 })
  }
}
