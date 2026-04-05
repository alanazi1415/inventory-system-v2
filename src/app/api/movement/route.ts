import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

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

// رفع وتحليل تقرير الحركة (يستقبل JSON من المتصفح بدل ملف)
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const body = await request.json()
    const { items, system, fileName, totalRecords, dateFrom, dateTo } = body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }
    
    console.log(`Processing ${items.length} aggregated items for system: ${system}`)
    
    // حفظ في قاعدة البيانات
    let savedCount = 0
    
    for (const item of items) {
      const genericItemNumber = item.genericItemNumber
      const totalQty = item.totalQty || 0
      const transactionCount = item.transactionCount || 0
      const description = item.description || ''
      
      const { movementClass, score } = classifyMovement(transactionCount, totalQty)
      
      // حساب الفترة الزمنية
      let daysSpan = 0
      let firstDate: Date | null = null
      let lastDate: Date | null = null
      
      const dates = item.dates || []
      if (dates.length > 0) {
        const sortedDates = dates.map((d: string) => new Date(d)).sort((a: Date, b: Date) => a.getTime() - b.getTime())
        firstDate = sortedDates[0]
        lastDate = sortedDates[sortedDates.length - 1]
        daysSpan = Math.ceil(((lastDate?.getTime() ?? 0) - (firstDate?.getTime() ?? 0)) / (1000 * 60 * 60 * 24))
      }
      
      try {
        await db.itemMovement.upsert({
          where: {
            genericItemNumber_system: {
              genericItemNumber,
              system
            }
          },
          update: {
            description,
            totalQtyDispatched: totalQty,
            transactionCount,
            avgQtyPerTransaction: transactionCount > 0 ? totalQty / transactionCount : 0,
            firstDispatchDate: firstDate,
            lastDispatchDate: lastDate,
            daysSpan,
            movementClass,
            movementScore: score,
            lastAnalysisDate: new Date(),
            reportSource: fileName
          },
          create: {
            genericItemNumber,
            description,
            system,
            totalQtyDispatched: totalQty,
            transactionCount,
            avgQtyPerTransaction: transactionCount > 0 ? totalQty / transactionCount : 0,
            firstDispatchDate: firstDate,
            lastDispatchDate: lastDate,
            daysSpan,
            movementClass,
            movementScore: score,
            reportSource: fileName
          }
        })
        savedCount++
      } catch (e) {
        console.error('Error saving item:', genericItemNumber, e)
      }
    }
    
    // تسجيل التقرير
    try {
      await db.movementReportLog.create({
        data: {
          fileName: fileName || 'unknown',
          system,
          recordsCount: totalRecords || 0,
          itemsCount: items.length,
          dateFrom: dateFrom ? new Date(dateFrom) : null,
          dateTo: dateTo ? new Date(dateTo) : null
        }
      })
    } catch (e) {
      console.error('Error logging report:', e)
    }
    
    return NextResponse.json({
      success: true,
      message: 'تم تحليل التقرير بنجاح',
      stats: {
        totalRecords: totalRecords || 0,
        uniqueItems: items.length,
        savedItems: savedCount
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
