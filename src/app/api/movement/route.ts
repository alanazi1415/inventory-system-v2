import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return true
      }
      
      if (!adminSession) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        try {
          await db.adminSession.create({
            data: { token: session.value, expiresAt }
          })
          return true
        } catch (e) {
          console.log('Failed to recreate session:', e)
        }
      }
    }
    return false
  } catch (error) {
    console.error('Admin auth check error:', error)
    return false
  }
}

// تصنيف الحركة
function classifyMovement(transactionCount: number, totalQty: number): { movementClass: string; score: number } {
  // حساب درجة مركبة
  const score = (transactionCount * 10) + (totalQty / 100)
  
  if (transactionCount >= 50 && totalQty >= 5000) {
    return { movementClass: 'سريع جداً', score }
  } else if (transactionCount >= 20 && totalQty >= 2000) {
    return { movementClass: 'سريع', score }
  } else if (transactionCount >= 10 && totalQty >= 500) {
    return { movementClass: 'متوسط', score }
  } else if (transactionCount >= 3) {
    return { movementClass: 'بطيء', score }
  } else {
    return { movementClass: 'عديم الحركة', score }
  }
}

// تحليل الأعمدة بشكل ذكي
function analyzeColumns(headers: string[]): {
  itemNumberCol: number | null
  qtyCol: number | null
  dateCol: number | null
  descCol: number | null
  warehouseCol: number | null
} {
  const result = {
    itemNumberCol: null as number | null,
    qtyCol: null as number | null,
    dateCol: null as number | null,
    descCol: null as number | null,
    warehouseCol: null as number | null
  }
  
  const itemNumberKeywords = ['generic item number', 'item number', 'generic', 'رقم البند', 'كود']
  const qtyKeywords = ['pick qty', 'quantity', 'qty', 'الكمية', 'صرف']
  const dateKeywords = ['date', 'creation', 'تاريخ', 'confirm', 'approve']
  const descKeywords = ['description', 'وصف', 'trade description', 'name']
  const warehouseKeywords = ['warehouse', 'مستودع', 'system', 'نظام']
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim()
    
    if (!result.itemNumberCol && itemNumberKeywords.some(k => h.includes(k))) {
      result.itemNumberCol = index
    }
    if (!result.qtyCol && qtyKeywords.some(k => h.includes(k))) {
      result.qtyCol = index
    }
    if (!result.dateCol && dateKeywords.some(k => h.includes(k))) {
      result.dateCol = index
    }
    if (!result.descCol && descKeywords.some(k => h.includes(k))) {
      result.descCol = index
    }
    if (!result.warehouseCol && warehouseKeywords.some(k => h.includes(k))) {
      result.warehouseCol = index
    }
  })
  
  return result
}

// رفع وتحليل تقرير الحركة
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const system = formData.get('system') as string || 'mwsal'
    
    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 })
    }
    
    console.log('Processing movement report:', file.name, 'for system:', system)
    
    // قراءة الملف
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(Buffer.from(buffer), { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    
    if (data.length < 2) {
      return NextResponse.json({ error: 'الملف فارغ أو لا يحتوي بيانات' }, { status: 400 })
    }
    
    // تحليل الأعمدة
    const headers = data[0] as string[]
    const colMap = analyzeColumns(headers)
    
    console.log('Column mapping:', colMap)
    
    if (colMap.itemNumberCol === null || colMap.qtyCol === null) {
      return NextResponse.json({ 
        error: 'لم يتم العثور على أعمدة مطلوبة',
        details: 'يجب أن يحتوي الملف على عمود رقم البند وعمود الكمية',
        foundColumns: headers.filter(h => h).slice(0, 10)
      }, { status: 400 })
    }
    
    // تحليل البيانات
    const movementMap = new Map<string, {
      totalQty: number
      transactionCount: number
      description: string
      dates: Date[]
    }>()
    
    let dateFrom: Date | null = null
    let dateTo: Date | null = null
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue
      
      const itemNumber = String(row[colMap.itemNumberCol!] || '').trim()
      const qty = parseFloat(row[colMap.qtyCol!]) || 0
      
      if (!itemNumber || qty <= 0) continue
      
      // استخراج الوصف
      const description = colMap.descCol !== null ? String(row[colMap.descCol] || '') : ''
      
      // استخراج التاريخ
      let date: Date | null = null
      if (colMap.dateCol !== null && row[colMap.dateCol]) {
        const dateValue = row[colMap.dateCol]
        if (typeof dateValue === 'number') {
          date = new Date((dateValue - 25569) * 86400 * 1000)
        } else {
          date = new Date(dateValue)
        }
        
        if (!isNaN(date.getTime())) {
          if (!dateFrom || date < dateFrom) dateFrom = date
          if (!dateTo || date > dateTo) dateTo = date
        }
      }
      
      // تجميع البيانات
      const existing = movementMap.get(itemNumber) || {
        totalQty: 0,
        transactionCount: 0,
        description: '',
        dates: [] as Date[]
      }
      
      existing.totalQty += qty
      existing.transactionCount += 1
      if (description && !existing.description) {
        existing.description = description.substring(0, 200)
      }
      if (date && !isNaN(date.getTime())) {
        existing.dates.push(date)
      }
      
      movementMap.set(itemNumber, existing)
    }
    
    console.log(`Analyzed ${movementMap.size} items from ${data.length - 1} rows`)
    
    // حفظ في قاعدة البيانات
    let savedCount = 0
    const batchSize = 100
    const items = Array.from(movementMap.entries())
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      for (const [itemNumber, stats] of batch) {
        const { movementClass, score } = classifyMovement(stats.transactionCount, stats.totalQty)
        
        // حساب الفترة الزمنية
        let daysSpan = 0
        let firstDate: Date | null = null
        let lastDate: Date | null = null
        
        if (stats.dates.length > 0) {
          const sortedDates = stats.dates.sort((a, b) => a.getTime() - b.getTime())
          firstDate = sortedDates[0]
          lastDate = sortedDates[sortedDates.length - 1]
          daysSpan = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
        }
        
        try {
          await db.itemMovement.upsert({
            where: {
              genericItemNumber_system: {
                genericItemNumber: itemNumber,
                system: system
              }
            },
            update: {
              description: stats.description,
              totalQtyDispatched: stats.totalQty,
              transactionCount: stats.transactionCount,
              avgQtyPerTransaction: stats.totalQty / stats.transactionCount,
              firstDispatchDate: firstDate,
              lastDispatchDate: lastDate,
              daysSpan,
              movementClass,
              movementScore: score,
              lastAnalysisDate: new Date(),
              reportSource: file.name
            },
            create: {
              genericItemNumber: itemNumber,
              description: stats.description,
              system,
              totalQtyDispatched: stats.totalQty,
              transactionCount: stats.transactionCount,
              avgQtyPerTransaction: stats.totalQty / stats.transactionCount,
              firstDispatchDate: firstDate,
              lastDispatchDate: lastDate,
              daysSpan,
              movementClass,
              movementScore: score,
              reportSource: file.name
            }
          })
          savedCount++
        } catch (e) {
          console.error('Error saving item:', itemNumber, e)
        }
      }
    }
    
    // تسجيل التقرير
    await db.movementReportLog.create({
      data: {
        fileName: file.name,
        system,
        recordsCount: data.length - 1,
        itemsCount: movementMap.size,
        dateFrom,
        dateTo
      }
    })
    
    // إحصائيات التصنيف
    const classStats = new Map<string, number>()
    movementMap.forEach((stats) => {
      const { movementClass } = classifyMovement(stats.transactionCount, stats.totalQty)
      classStats.set(movementClass, (classStats.get(movementClass) || 0) + 1)
    })
    
    return NextResponse.json({
      success: true,
      message: 'تم تحليل التقرير بنجاح',
      stats: {
        totalRecords: data.length - 1,
        uniqueItems: movementMap.size,
        savedItems: savedCount,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        classification: Object.fromEntries(classStats)
      }
    })
    
  } catch (error: any) {
    console.error('Movement upload error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في تحليل التقرير',
      details: error.message 
    }, { status: 500 })
  }
}

// جلب بيانات الحركة
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const movementClass = searchParams.get('class')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // دعم عدة تصنيفات عبر تكرار معامل class
    const allClasses = searchParams.getAll('class').filter(c => c && c !== 'all')

    const where: any = { system }

    if (allClasses.length > 0) {
      where.movementClass = { in: allClasses }
    } else if (movementClass && movementClass !== 'all') {
      where.movementClass = movementClass
    }

    if (search) {
      where.OR = [
        { genericItemNumber: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [items, total, classCounts] = await Promise.all([
      db.itemMovement.findMany({
        where,
        orderBy: { movementScore: 'desc' },
        take: limit,
        skip: offset
      }),
      db.itemMovement.count({ where }),
      db.itemMovement.groupBy({
        by: ['movementClass'],
        where: { system },
        _count: { id: true }
      })
    ])

    return NextResponse.json({
      items,
      total,
      classCounts: classCounts.map(c => ({
        class: c.movementClass,
        count: c._count.id
      })),
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error: any) {
    console.error('Get movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
