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

// التحقق من صلاحية المستخدم (لتحليل الحركة)
async function checkUserMovementAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('user_session')
    
    if (session?.value) {
      const userSession = await db.userSession.findUnique({
        where: { token: session.value },
        include: { user: true }
      })
      
      if (userSession && userSession.expiresAt > new Date() && userSession.user.isActive) {
        return !!userSession.user.canViewMovement
      }
    }
    return false
  } catch (error) {
    console.error('User movement auth check error:', error)
    return false
  }
}

// التحقق من صلاحية (أدمن أو مستخدم مصرح له)
async function checkMovementAccess(): Promise<boolean> {
  const isAdmin = await checkAdminAuth()
  if (isAdmin) return true
  return checkUserMovementAuth()
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

// مزامنة البنود من المخزون إلى تحليل الحركة (كعديمة حركة إذا لم يكن لها سجلات)
async function syncInventoryToMovement(system: string) {
  console.log(`Syncing inventory items to movement for system: ${system}`)
  
  // جلب جميع أرقام البنود من المخزون
  const inventoryItems = await db.inventoryItem.findMany({
    where: { system },
    select: {
      genericItemNumber: true,
      genericItemDescription: true,
      customerItemNumber: true,
      tradeItemNumber: true
    }
  })
  
  // جلب جميع أرقام البنود الموجودة في تحليل الحركة
  const existingMovements = await db.itemMovement.findMany({
    where: { system },
    select: { genericItemNumber: true }
  })
  const existingNumbers = new Set(existingMovements.map(m => m.genericItemNumber))
  
  // البنود التي ليس لها حركة
  const itemsWithoutMovement: { itemNumber: string; description: string | null }[] = []
  
  for (const item of inventoryItems) {
    // التحقق من جميع أرقام البند المحتملة
    const numbers = [
      item.genericItemNumber,
      item.customerItemNumber,
      item.tradeItemNumber
    ].filter(Boolean) as string[]
    
    // إذا لم يكن أي من الأرقام موجوداً في تحليل الحركة
    const hasMovement = numbers.some(n => existingNumbers.has(n))
    
    if (!hasMovement && numbers.length > 0) {
      // استخدام الرقم الأول المتاح
      itemsWithoutMovement.push({
        itemNumber: numbers[0],
        description: item.genericItemDescription
      })
    }
  }
  
  console.log(`Found ${itemsWithoutMovement.length} items without movement`)
  
  // إضافة البنود بدون حركة كـ "عديم الحركة"
  let addedCount = 0
  for (const item of itemsWithoutMovement) {
    try {
      await db.itemMovement.create({
        data: {
          genericItemNumber: item.itemNumber,
          description: item.description,
          system,
          totalQtyDispatched: 0,
          transactionCount: 0,
          avgQtyPerTransaction: 0,
          movementClass: 'عديم الحركة',
          movementScore: 0,
          reportSource: 'مزامنة تلقائية من المخزون'
        }
      })
      addedCount++
    } catch (e) {
      // قد يكون موجوداً بالفعل (unique constraint)
    }
  }
  
  return { total: inventoryItems.length, added: addedCount, withoutMovement: itemsWithoutMovement.length }
}

// رفع وتحليل تقرير الحركة (يستقبل JSON من المتصفح بدل ملف)
export async function POST(request: NextRequest) {
  try {
    const hasAccess = await checkMovementAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    // التحقق من نوع الطلب (مزامنة أم رفع)
    const contentType = request.headers.get('content-type') || ''
    
    // إذا كان طلب مزامنة
    if (contentType.includes('application/json')) {
      const body = await request.json()
      
      // طلب مزامنة المخزون
      if (body.syncInventory) {
        const system = body.system || 'mwsal'
        const result = await syncInventoryToMovement(system)
        return NextResponse.json({
          success: true,
          message: 'تمت المزامنة بنجاح',
          stats: result
        })
      }
      
      // رفع عادي (JSON data)
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
      
      // مزامنة البنود من المخزون بعد الرفع
      const syncResult = await syncInventoryToMovement(system)
      
      return NextResponse.json({
        success: true,
        message: 'تم تحليل التقرير بنجاح',
        stats: {
          totalRecords: totalRecords || 0,
          uniqueItems: items.length,
          savedItems: savedCount,
          syncedFromInventory: syncResult
        }
      })
    }
    
    return NextResponse.json({ error: 'نوع الطلب غير مدعوم' }, { status: 400 })
    
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
    const sync = searchParams.get('sync') === 'true'

    // إذا كان طلب مزامنة
    if (sync) {
      const result = await syncInventoryToMovement(system)
      return NextResponse.json({
        success: true,
        message: 'تمت المزامنة بنجاح',
        stats: result
      })
    }

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

    // تحديد الترتيب بناءً على الفلتر
    // عند فلتر "عديم الحركة"، نرتب حسب رقم البند (أبجدياً)
    // وإلا نرتب حسب درجة الحركة (الأعلى أولاً)
    const orderBy = movementClass === 'عديم الحركة' 
      ? { genericItemNumber: 'asc' as const }
      : { movementScore: 'desc' as const }

    const [items, total, classCounts] = await Promise.all([
      db.itemMovement.findMany({
        where,
        orderBy,
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

    // حساب عدد الأيام منذ آخر صرف لكل بند
    const now = new Date()
    const itemsWithDaysSince = items.map(item => {
      let daysSinceLastDispatch: number | null = null
      if (item.lastDispatchDate) {
        const lastDispatch = new Date(item.lastDispatchDate)
        daysSinceLastDispatch = Math.ceil((now.getTime() - lastDispatch.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceLastDispatch < 0) daysSinceLastDispatch = 0
      }
      return {
        ...item,
        daysSinceLastDispatch
      }
    })

    return NextResponse.json({
      items: itemsWithDaysSince,
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
