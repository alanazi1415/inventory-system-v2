import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

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
      
      // جلب جميع أرقام البنود من المخزون
      const inventoryItems = await db.inventoryItem.findMany({
        where: { system },
        select: {
          genericItemNumber: true,
          genericItemDescription: true,
          totalQty: true,
          availableQty: true
        }
      })
      
      // جلب البنود الموجودة
      const existingMovements = await db.itemMovement.findMany({
        where: { system },
        select: { genericItemNumber: true }
      })
      const existingNumbers = new Set(existingMovements.map(m => m.genericItemNumber))
      
      const thresholds = await getThresholds(system)
      const { movementClass, score } = classifyMovement(0, 0, thresholds)
      
      let addedCount = 0
      
      // إضافة البنود غير الموجودة
      for (const item of inventoryItems) {
        if (item.genericItemNumber && !existingNumbers.has(item.genericItemNumber)) {
          try {
            await db.itemMovement.create({
              data: {
                genericItemNumber: item.genericItemNumber,
                description: item.genericItemDescription,
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
          } catch {
            // تجاهل الأخطاء (البند موجود مسبقاً)
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'تمت المزامنة بنجاح',
        stats: {
          totalInventoryItems: inventoryItems.length,
          added: addedCount
        }
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
      try {
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
      } catch {
        // تجاهل إذا فشل تسجيل السجل
      }
      
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
    
    // رفع تقرير الحركة - محسن للسرعة
    const { items, system, fileName, totalRecords, dateFrom, dateTo, analysisPeriodDays } = body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }
    
    console.log(`Processing ${items.length} items for system: ${system}`)
    
    const thresholds = await getThresholds(system)
    const periodDays = analysisPeriodDays || thresholds.defaultAnalysisPeriod
    
    // تحضير البيانات للحفظ
    const itemsToSave = items.map((item: any) => {
      const totalQty = item.totalQty || 0
      const transactionCount = item.transactionCount || 0
      const { movementClass, score } = classifyMovement(transactionCount, totalQty, thresholds)
      
      return {
        genericItemNumber: item.genericItemNumber,
        description: item.description || '',
        system,
        totalQtyDispatched: totalQty,
        transactionCount,
        avgQtyPerTransaction: transactionCount > 0 ? totalQty / transactionCount : 0,
        autoMovementClass: movementClass,
        movementScore: score,
        batchCount: item.batchCount || 0,
        uniqueExpiryDates: item.uniqueExpiryDates || 0,
        uniqueOrders: item.uniqueOrders || 0,
        reportSource: fileName,
        analysisPeriodDays: periodDays,
        analysisDateFrom: dateFrom ? new Date(dateFrom) : null,
        analysisDateTo: dateTo ? new Date(dateTo) : null
      }
    })
    
    // حفظ باستخدام $transaction للسرعة
    let savedCount = 0
    
    // حفظ في دفعات صغيرة
    const batchSize = 100
    for (let i = 0; i < itemsToSave.length; i += batchSize) {
      const batch = itemsToSave.slice(i, i + batchSize)
      
      const queries = batch.map(item => 
        db.itemMovement.upsert({
          where: {
            genericItemNumber_system: {
              genericItemNumber: item.genericItemNumber,
              system: item.system
            }
          },
          update: {
            description: item.description,
            totalQtyDispatched: item.totalQtyDispatched,
            transactionCount: item.transactionCount,
            avgQtyPerTransaction: item.avgQtyPerTransaction,
            autoMovementClass: item.autoMovementClass,
            movementScore: item.movementScore,
            batchCount: item.batchCount,
            uniqueExpiryDates: item.uniqueExpiryDates,
            uniqueOrders: item.uniqueOrders,
            lastAnalysisDate: new Date(),
            reportSource: item.reportSource,
            analysisPeriodDays: item.analysisPeriodDays,
            analysisDateFrom: item.analysisDateFrom,
            analysisDateTo: item.analysisDateTo,
            syncedFromInventory: false
          },
          create: item
        })
      )
      
      try {
        await db.$transaction(queries)
        savedCount += batch.length
      } catch (e) {
        console.error('Batch error:', e)
        // محاولة حفظ بشكل فردي
        for (const item of batch) {
          try {
            await db.itemMovement.upsert({
              where: {
                genericItemNumber_system: {
                  genericItemNumber: item.genericItemNumber,
                  system: item.system
                }
              },
              update: item,
              create: item
            })
            savedCount++
          } catch {
            // تجاهل
          }
        }
      }
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

// معالجة طلب GET (جلب البيانات)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const movementClass = searchParams.get('class')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const periodDays = parseInt(searchParams.get('periodDays') || '0')

    // بناء شروط البحث
    const allClasses = searchParams.getAll('class').filter(c => c && c !== 'all')
    const useUserClass = searchParams.get('useUserClass') === 'true'

    const where: any = { system }

    // فلترة حسب التصنيف
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
    
    // تسجيل التغيير
    if (userMovementClass && userMovementClass !== currentItem.userMovementClass) {
      try {
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
      } catch {
        // تجاهل
      }
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
