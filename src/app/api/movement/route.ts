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
    }
    return false
  } catch (error) {
    console.error('Admin auth check error:', error)
    return false
  }
}

// التحقق من صلاحية المستخدم
async function checkUserMovementAuth(): Promise<{ canView: boolean; canClassify: boolean; userId: string; username: string }> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('user_session')
    
    if (session?.value) {
      const userSession = await db.userSession.findUnique({
        where: { token: session.value },
        include: { user: true }
      })
      
      if (userSession && userSession.expiresAt > new Date() && userSession.user.isActive) {
        return {
          canView: !!userSession.user.canViewMovement,
          canClassify: !!userSession.user.canClassifyMovement,
          userId: userSession.userId,
          username: userSession.user.name
        }
      }
    }
    return { canView: false, canClassify: false, userId: '', username: '' }
  } catch (error) {
    console.error('User movement auth check error:', error)
    return { canView: false, canClassify: false, userId: '', username: '' }
  }
}

// التحقق من صلاحية الوصول
async function checkMovementAccess(): Promise<{ hasAccess: boolean; canClassify: boolean; userId: string; username: string }> {
  const isAdmin = await checkAdminAuth()
  if (isAdmin) {
    return { hasAccess: true, canClassify: true, userId: 'admin', username: 'مدير النظام' }
  }
  const userAuth = await checkUserMovementAuth()
  return { 
    hasAccess: userAuth.canView, 
    canClassify: userAuth.canClassify,
    userId: userAuth.userId,
    username: userAuth.username
  }
}

// القيم الافتراضية للحدود
const DEFAULT_THRESHOLDS = {
  veryFastMinTransactions: 50,
  veryFastMinQty: 5000,
  fastMinTransactions: 20,
  fastMinQty: 2000,
  mediumMinTransactions: 10,
  mediumMinQty: 500,
  slowMinTransactions: 3,
  defaultAnalysisPeriod: 90
}

// جلب إعدادات الحدود
async function getThresholds(system: string) {
  try {
    const thresholds = await db.movementThresholds.findUnique({
      where: { system }
    })
    return thresholds || DEFAULT_THRESHOLDS
  } catch (error) {
    console.error('Error fetching thresholds:', error)
    return DEFAULT_THRESHOLDS
  }
}

// تصنيف الحركة التلقائي
function classifyMovement(
  transactionCount: number, 
  totalQty: number, 
  thresholds: typeof DEFAULT_THRESHOLDS
): { movementClass: string; score: number } {
  const score = (transactionCount * 10) + (totalQty / 100)
  
  if (transactionCount >= thresholds.veryFastMinTransactions && totalQty >= thresholds.veryFastMinQty) {
    return { movementClass: 'سريع جداً', score }
  } else if (transactionCount >= thresholds.fastMinTransactions && totalQty >= thresholds.fastMinQty) {
    return { movementClass: 'سريع', score }
  } else if (transactionCount >= thresholds.mediumMinTransactions && totalQty >= thresholds.mediumMinQty) {
    return { movementClass: 'متوسط', score }
  } else if (transactionCount >= thresholds.slowMinTransactions) {
    return { movementClass: 'بطيء', score }
  } else {
    return { movementClass: 'عديم الحركة', score }
  }
}

// مزامنة البنود من المخزون
async function syncInventoryToMovement(system: string, analysisPeriodDays: number = 90) {
  console.log(`Syncing inventory items to movement for system: ${system}`)
  
  // جلب جميع أرقام البنود من المخزون
  const inventoryItems = await db.inventoryItem.findMany({
    where: { system },
    select: {
      genericItemNumber: true,
      genericItemDescription: true,
      customerItemNumber: true,
      tradeItemNumber: true,
      totalQty: true,
      availableQty: true
    }
  })
  
  console.log(`Found ${inventoryItems.length} items in inventory for system ${system}`)
  
  // جلب جميع أرقام البنود الموجودة في تحليل الحركة
  const existingMovements = await db.itemMovement.findMany({
    where: { system },
    select: { genericItemNumber: true }
  })
  const existingNumbers = new Set(existingMovements.map(m => m.genericItemNumber))
  
  // خريطة لجميع أرقام البنود في المخزون
  const inventoryNumbersMap = new Map<string, { description: string | null; totalQty: number; availableQty: number }>()
  
  for (const item of inventoryItems) {
    const numbers = [
      item.genericItemNumber,
      item.customerItemNumber,
      item.tradeItemNumber
    ].filter((n): n is string => Boolean(n && n.trim()))
    
    for (const num of numbers) {
      if (!inventoryNumbersMap.has(num)) {
        inventoryNumbersMap.set(num, {
          description: item.genericItemDescription,
          totalQty: item.totalQty,
          availableQty: item.availableQty
        })
      }
    }
  }
  
  console.log(`Found ${inventoryNumbersMap.size} unique item numbers in inventory`)
  
  // البنود التي ليست في تحليل الحركة
  const itemsToAdd: Array<{ itemNumber: string; description: string | null; totalQty: number; availableQty: number }> = []
  
  for (const [itemNumber, data] of inventoryNumbersMap) {
    if (!existingNumbers.has(itemNumber)) {
      itemsToAdd.push({
        itemNumber,
        description: data.description,
        totalQty: data.totalQty,
        availableQty: data.availableQty
      })
    }
  }
  
  console.log(`Items without movement to add: ${itemsToAdd.length}`)
  
  const thresholds = await getThresholds(system)
  const { movementClass, score } = classifyMovement(0, 0, thresholds)
  
  // إضافة البنود بدون حركة
  let addedCount = 0
  let updatedCount = 0
  
  for (const item of itemsToAdd) {
    try {
      await db.itemMovement.create({
        data: {
          genericItemNumber: item.itemNumber,
          description: item.description,
          system,
          totalQtyDispatched: 0,
          transactionCount: 0,
          avgQtyPerTransaction: 0,
          autoMovementClass: movementClass,
          movementScore: score,
          currentStock: item.totalQty,
          availableStock: item.availableQty,
          analysisPeriodDays: thresholds.defaultAnalysisPeriod,
          reportSource: 'مزامنة تلقائية من المخزون',
          syncedFromInventory: true
        }
      })
      addedCount++
    } catch (e: any) {
      // قد يكون موجوداً بالفعل - تحديثه بدلاً من ذلك
      try {
        await db.itemMovement.update({
          where: {
            genericItemNumber_system: {
              genericItemNumber: item.itemNumber,
              system
            }
          },
          data: {
            currentStock: item.totalQty,
            availableStock: item.availableQty,
            syncedFromInventory: true
          }
        })
        updatedCount++
      } catch (updateError) {
        // تجاهل
      }
    }
  }
  
  // تحديث المخزون الحالي للبنود الموجودة
  for (const [itemNumber, data] of inventoryNumbersMap) {
    if (existingNumbers.has(itemNumber)) {
      try {
        await db.itemMovement.update({
          where: {
            genericItemNumber_system: {
              genericItemNumber: itemNumber,
              system
            }
          },
          data: {
            currentStock: data.totalQty,
            availableStock: data.availableQty,
            syncedFromInventory: true
          }
        })
        updatedCount++
      } catch (e) {
        // تجاهل
      }
    }
  }
  
  return { 
    totalInventoryItems: inventoryItems.length,
    uniqueNumbers: inventoryNumbersMap.size,
    added: addedCount, 
    updated: updatedCount,
    withoutMovement: itemsToAdd.length
  }
}

// معالجة طلب POST (رفع التقرير أو التصنيف اليدوي أو المزامنة)
export async function POST(request: NextRequest) {
  try {
    const access = await checkMovementAccess()
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const body = await request.json()
    
    // طلب مزامنة المخزون
    if (body.syncInventory) {
      const system = body.system || 'mwsal'
      const analysisPeriodDays = body.analysisPeriodDays || 90
      const result = await syncInventoryToMovement(system, analysisPeriodDays)
      return NextResponse.json({
        success: true,
        message: 'تمت المزامنة بنجاح',
        stats: result
      })
    }
    
    // طلب تصنيف يدوي
    if (body.classifyItem) {
      if (!access.canClassify) {
        return NextResponse.json({ error: 'غير مصرح لك بالتصنيف اليدوي' }, { status: 403 })
      }
      
      const { itemNumber, system, newClass, reason } = body
      
      if (!itemNumber || !system || !newClass) {
        return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
      }
      
      // جلب التصنيف الحالي
      const currentItem = await db.itemMovement.findUnique({
        where: {
          genericItemNumber_system: {
            genericItemNumber: itemNumber,
            system
          }
        }
      })
      
      if (!currentItem) {
        return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })
      }
      
      // تسجيل التغيير
      await db.classificationLog.create({
        data: {
          itemNumber,
          system,
          oldClass: currentItem.userMovementClass || currentItem.autoMovementClass,
          newClass,
          changedBy: access.username,
          reason: reason || null
        }
      })
      
      // تحديث التصنيف
      await db.itemMovement.update({
        where: {
          genericItemNumber_system: {
            genericItemNumber: itemNumber,
            system
          }
        },
        data: {
          userMovementClass: newClass,
          classifiedBy: access.username,
          classifiedAt: new Date(),
          notes: reason || null
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'تم تحديث التصنيف بنجاح'
      })
    }
    
    // رفع تقرير الحركة
    const { items, system, fileName, totalRecords, dateFrom, dateTo, analysisPeriodDays } = body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }
    
    console.log(`Processing ${items.length} aggregated items for system: ${system}`)
    
    const thresholds = await getThresholds(system)
    const periodDays = analysisPeriodDays || thresholds.defaultAnalysisPeriod
    
    // حفظ في قاعدة البيانات
    let savedCount = 0
    
    for (const item of items) {
      const genericItemNumber = item.genericItemNumber
      const totalQty = item.totalQty || 0
      const transactionCount = item.transactionCount || 0
      const description = item.description || ''
      const batchCount = item.batchCount || 0
      const uniqueExpiryDates = item.uniqueExpiryDates || 0
      const uniqueOrders = item.uniqueOrders || 0
      
      const { movementClass, score } = classifyMovement(transactionCount, totalQty, thresholds)
      
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
            autoMovementClass: movementClass,
            movementScore: score,
            batchCount,
            uniqueExpiryDates,
            uniqueOrders,
            lastAnalysisDate: new Date(),
            reportSource: fileName,
            analysisPeriodDays: periodDays,
            analysisDateFrom: dateFrom ? new Date(dateFrom) : null,
            analysisDateTo: dateTo ? new Date(dateTo) : null,
            syncedFromInventory: false
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
            autoMovementClass: movementClass,
            movementScore: score,
            batchCount,
            uniqueExpiryDates,
            uniqueOrders,
            reportSource: fileName,
            analysisPeriodDays: periodDays,
            analysisDateFrom: dateFrom ? new Date(dateFrom) : null,
            analysisDateTo: dateTo ? new Date(dateTo) : null
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
          dateTo: dateTo ? new Date(dateTo) : null,
          analysisPeriodDays: periodDays
        }
      })
    } catch (e) {
      console.error('Error logging report:', e)
    }
    
    // مزامنة البنود من المخزون بعد الرفع
    const syncResult = await syncInventoryToMovement(system, periodDays)
    
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
    
  } catch (error: any) {
    console.error('Movement upload error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في تحليل التقرير',
      details: error.message 
    }, { status: 500 })
  }
}

// معالجة طلب GET (جلب البيانات)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const movementClass = searchParams.get('class')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sync = searchParams.get('sync') === 'true'
    const periodDays = parseInt(searchParams.get('periodDays') || '0')

    // إذا كان طلب مزامنة
    if (sync) {
      const result = await syncInventoryToMovement(system, periodDays || 90)
      return NextResponse.json({
        success: true,
        message: 'تمت المزامنة بنجاح',
        stats: result
      })
    }

    // بناء شروط البحث
    const allClasses = searchParams.getAll('class').filter(c => c && c !== 'all')
    const useUserClass = searchParams.get('useUserClass') === 'true'

    const where: any = { system }

    // فلترة حسب التصنيف (يدوي أو تلقائي)
    if (allClasses.length > 0) {
      if (useUserClass) {
        where.OR = allClasses.map(cls => [
          { userMovementClass: cls },
          { userMovementClass: null, autoMovementClass: cls }
        ]).flat()
      } else {
        where.OR = [
          { autoMovementClass: { in: allClasses } },
          { autoMovementClass: { in: allClasses } }
        ]
      }
    } else if (movementClass && movementClass !== 'all') {
      if (useUserClass) {
        where.OR = [
          { userMovementClass: movementClass },
          { userMovementClass: null, autoMovementClass: movementClass }
        ]
      } else {
        where.autoMovementClass = movementClass
      }
    }

    if (search) {
      where.OR = [
        { genericItemNumber: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // فلترة حسب الفترة الزمنية
    if (periodDays > 0) {
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - periodDays)
      where.lastDispatchDate = { gte: dateFrom }
    }

    // الترتيب
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
        by: ['autoMovementClass'],
        where: { system },
        _count: { id: true }
      })
    ])

    // حساب عدد الأيام منذ آخر صرف
    const now = new Date()
    const itemsWithDaysSince = items.map(item => {
      let daysSinceLastDispatch: number | null = null
      if (item.lastDispatchDate) {
        const lastDispatch = new Date(item.lastDispatchDate)
        daysSinceLastDispatch = Math.ceil((now.getTime() - lastDispatch.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceLastDispatch < 0) daysSinceLastDispatch = 0
      }
      
      // التصنيف الفعال (يدوي إن وجد، وإلا تلقائي)
      const effectiveClass = item.userMovementClass || item.autoMovementClass
      
      return {
        ...item,
        daysSinceLastDispatch,
        effectiveMovementClass: effectiveClass,
        isUserClassified: !!item.userMovementClass
      }
    })

    // إحصائيات إضافية
    const stats = await db.itemMovement.aggregate({
      where: { system },
      _count: { id: true },
      _sum: { totalQtyDispatched: true, transactionCount: true }
    })

    return NextResponse.json({
      items: itemsWithDaysSince,
      total,
      classCounts: classCounts.map(c => ({
        class: c.autoMovementClass,
        count: c._count.id
      })),
      stats: {
        totalItems: stats._count.id,
        totalQtyDispatched: stats._sum.totalQtyDispatched || 0,
        totalTransactions: stats._sum.transactionCount || 0
      },
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error: any) {
    console.error('Get movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// معالجة طلب PATCH (تحديث بند واحد)
export async function PATCH(request: NextRequest) {
  try {
    const access = await checkMovementAccess()
    if (!access.canClassify) {
      return NextResponse.json({ error: 'غير مصرح لك بالتصنيف اليدوي' }, { status: 403 })
    }
    
    const body = await request.json()
    const { itemNumber, system, userMovementClass, notes } = body
    
    if (!itemNumber || !system) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
    }
    
    const currentItem = await db.itemMovement.findUnique({
      where: {
        genericItemNumber_system: {
          genericItemNumber: itemNumber,
          system
        }
      }
    })
    
    if (!currentItem) {
      return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })
    }
    
    // تسجيل التغيير إذا تم تغيير التصنيف
    if (userMovementClass && userMovementClass !== currentItem.userMovementClass) {
      await db.classificationLog.create({
        data: {
          itemNumber,
          system,
          oldClass: currentItem.userMovementClass || currentItem.autoMovementClass,
          newClass: userMovementClass,
          changedBy: access.username,
          reason: notes || null
        }
      })
    }
    
    const updated = await db.itemMovement.update({
      where: {
        genericItemNumber_system: {
          genericItemNumber: itemNumber,
          system
        }
      },
      data: {
        userMovementClass: userMovementClass || null,
        classifiedBy: userMovementClass ? access.username : null,
        classifiedAt: userMovementClass ? new Date() : null,
        notes: notes || null
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'تم التحديث بنجاح',
      item: updated
    })
    
  } catch (error: any) {
    console.error('Update movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
