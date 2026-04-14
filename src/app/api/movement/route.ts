import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// دالة ذكية لجلب المخزون الكلي للبند
// تبحث بجميع الأرقام المتاحة وتجمع الكميات
async function getInventoryStock(itemNumber: string, system: string): Promise<{
  totalQty: number
  availableQty: number
  batchCount: number
  expiryDates: string[]
}> {
  try {
    // البحث بالرقم الرئيسي وأرقام التجارة والعميل
    const items = await db.inventoryItem.findMany({
      where: {
        system,
        OR: [
          { genericItemNumber: itemNumber },
          { tradeItemNumber: itemNumber },
          { customerItemNumber: itemNumber }
        ]
      },
      select: {
        totalQty: true,
        availableQty: true,
        expiryDate: true
      }
    })

    // تجميع الكميات
    let totalQty = 0
    let availableQty = 0
    const expiryDates: string[] = []

    for (const item of items) {
      totalQty += item.totalQty || 0
      availableQty += item.availableQty || 0
      if (item.expiryDate && !expiryDates.includes(item.expiryDate)) {
        expiryDates.push(item.expiryDate)
      }
    }

    return {
      totalQty,
      availableQty,
      batchCount: items.length, // عدد التشغيلات/الصفوف
      expiryDates
    }
  } catch (error) {
    console.error('Error getting inventory stock:', error)
    return { totalQty: 0, availableQty: 0, batchCount: 0, expiryDates: [] }
  }
}

// دالة لتحديث المخزون لجميع البنود في تحليل الحركة (مُحسّنة)
async function updateAllMovementStock(system: string): Promise<number> {
  try {
    // جلب جميع بنود المخزون مرة واحدة
    const inventoryItems = await db.inventoryItem.findMany({
      where: { system },
      select: {
        genericItemNumber: true,
        tradeItemNumber: true,
        customerItemNumber: true,
        totalQty: true,
        availableQty: true
      }
    })

    // تجميع المخزون لكل رقم بند
    const stockMap = new Map<string, { totalQty: number; availableQty: number }>()
    
    for (const item of inventoryItems) {
      const numbers: string[] = [item.genericItemNumber, item.tradeItemNumber, item.customerItemNumber].filter((n): n is string => Boolean(n))
      for (const num of numbers) {
        const existing = stockMap.get(num) || { totalQty: 0, availableQty: 0 }
        existing.totalQty += item.totalQty || 0
        existing.availableQty += item.availableQty || 0
        stockMap.set(num, existing)
      }
    }

    // تحديث جميع البنود بعملية واحدة
    let updatedCount = 0
    for (const [itemNumber, stock] of stockMap.entries()) {
      try {
        await db.$executeRawUnsafe(`
          UPDATE "ItemMovement"
          SET "currentStock" = ${stock.totalQty},
              "availableStock" = ${stock.availableQty},
              "updatedAt" = NOW()
          WHERE "genericItemNumber" = '${itemNumber.replace(/'/g, "''")}'
            AND "system" = '${system}'
        `)
        updatedCount++
      } catch {
        // تجاهل الأخطاء الفردية
      }
    }

    return updatedCount
  } catch (error) {
    console.error('Error updating movement stock:', error)
    return 0
  }
}

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

// مولد ID
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// معالجة طلب POST
export async function POST(request: NextRequest) {
  try {
    const access = await checkMovementAccess()
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const body = await request.json()
    
    // طلب تحديث المخزون فقط (محسن للسرعة)
    if (body.updateStock) {
      const system = body.system || 'mwsal'
      console.log(`Fast stock update for system: ${system}`)
      
      // تحديث جماعي سريع باستخدام SQL JOIN
      try {
        const result = await db.$executeRaw`
          UPDATE "ItemMovement" im
          SET 
            "currentStock" = COALESCE(inv.total_stock, 0),
            "availableStock" = COALESCE(inv.available_stock, 0),
            "updatedAt" = NOW()
          FROM (
            SELECT 
              "genericItemNumber" as item_num,
              SUM("totalQty") as total_stock,
              SUM("availableQty") as available_stock
            FROM "InventoryItem"
            WHERE "system" = ${system}
            GROUP BY "genericItemNumber"
          ) inv
          WHERE im."genericItemNumber" = inv.item_num
            AND im."system" = ${system}
        `
        
        console.log(`Bulk updated ${result} items`)
        
        return NextResponse.json({
          success: true,
          message: 'تم تحديث المخزون بنجاح',
          stats: { 
            updatedItems: result
          }
        })
      } catch (error: any) {
        console.error('Bulk update error:', error)
        return NextResponse.json({
          success: false,
          error: 'حدث خطأ في تحديث المخزون: ' + error.message
        })
      }
    }
    
    // طلب مزامنة المخزون (محسن للسرعة)
    if (body.syncInventory) {
      const system = body.system || 'mwsal'
      console.log(`Syncing inventory for system: ${system}`)
      
      try {
        const thresholds = await getThresholds(system)
        const { movementClass, score } = classifyMovement(0, 0, thresholds)
        
        // جلب البنود الفريدة من المخزون
        const inventoryItems = await db.$queryRaw<{ 
          itemNumber: string; 
          description: string | null; 
          totalQty: number; 
          availableQty: number 
        }[]>`
          SELECT 
            "genericItemNumber" as "itemNumber",
            MAX("genericItemDescription") as description,
            SUM("totalQty") as "totalQty",
            SUM("availableQty") as "availableQty"
          FROM "InventoryItem"
          WHERE "system" = ${system}
            AND "genericItemNumber" IS NOT NULL
            AND "genericItemNumber" != ''
          GROUP BY "genericItemNumber"
        `
        
        // جلب البنود الموجودة في تحليل الحركة
        const existingItems = await db.itemMovement.findMany({
          where: { system },
          select: { genericItemNumber: true }
        })
        const existingSet = new Set(existingItems.map(i => i.genericItemNumber))
        
        // فلترة البنود الجديدة فقط
        const newItems = inventoryItems.filter(item => !existingSet.has(item.itemNumber))
        
        if (newItems.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'تمت المزامنة بنجاح - جميع البنود موجودة',
            stats: { added: 0, total: inventoryItems.length, existing: existingSet.size }
          })
        }
        
        // إدراج البنود الجديدة
        let addedCount = 0
        for (const item of newItems) {
          try {
            await db.$executeRawUnsafe(`
              INSERT INTO "ItemMovement" (
                "id", "genericItemNumber", "description", "system",
                "totalQtyDispatched", "transactionCount", "avgQtyPerTransaction",
                "autoMovementClass", "movementScore", "currentStock", "availableStock",
                "analysisPeriodDays", "reportSource", "syncedFromInventory", "createdAt"
              ) VALUES (
                '${generateId()}',
                '${item.itemNumber.replace(/'/g, "''")}',
                ${item.description ? `'${item.description.replace(/'/g, "''")}'` : 'NULL'},
                '${system}',
                0, 0, 0,
                '${movementClass}', ${score},
                ${item.totalQty || 0}, ${item.availableQty || 0},
                ${thresholds.defaultAnalysisPeriod}, 'مزامنة تلقائية', true, NOW()
              )
            `)
            addedCount++
          } catch {
            // تجاهل الأخطاء الفردية
          }
        }
        
        console.log(`Synced ${addedCount} new items out of ${newItems.length}`)
        
        return NextResponse.json({
          success: true,
          message: 'تمت المزامنة بنجاح',
          stats: { 
            added: addedCount,
            total: inventoryItems.length,
            existing: existingSet.size,
            newFound: newItems.length
          }
        })
      } catch (error: any) {
        console.error('Sync error:', error)
        return NextResponse.json({
          success: false,
          error: 'حدث خطأ في المزامنة: ' + error.message
        })
      }
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
      
      const currentItem = await db.itemMovement.findFirst({
        where: { genericItemNumber: itemNumber, system }
      })
      
      if (!currentItem) {
        return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })
      }
      
      try {
        await db.$executeRawUnsafe(`
          INSERT INTO "ClassificationLog" ("id", "itemNumber", "system", "oldClass", "newClass", "changedBy", "reason", "createdAt")
          VALUES ('${generateId()}', '${itemNumber}', '${system}', 
            ${currentItem.userMovementClass || currentItem.autoMovementClass ? `'${currentItem.userMovementClass || currentItem.autoMovementClass}'` : 'NULL'},
            '${newClass}', '${access.username}', ${reason ? `'${reason.replace(/'/g, "''")}'` : 'NULL'}, NOW()
          )
        `)
      } catch {
        // تجاهل
      }
      
      await db.$executeRawUnsafe(`
        UPDATE "ItemMovement" 
        SET "userMovementClass" = '${newClass}',
            "classifiedBy" = '${access.username}',
            "classifiedAt" = NOW(),
            "notes" = ${reason ? `'${reason.replace(/'/g, "''")}'` : 'NULL'},
            "updatedAt" = NOW()
        WHERE "genericItemNumber" = '${itemNumber}' AND "system" = '${system}'
      `)
      
      return NextResponse.json({ success: true, message: 'تم تحديث التصنيف بنجاح' })
    }
    
    // رفع تقرير الحركة
    const { items, system, fileName, totalRecords, dateFrom, dateTo, analysisPeriodDays, clearExisting, isLastBatch } = body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }
    
    console.log(`Processing ${items.length} items for system: ${system}`)
    
    const thresholds = await getThresholds(system)
    const periodDays = analysisPeriodDays || thresholds.defaultAnalysisPeriod
    
    // استخدام UPSERT بدلاً من INSERT لتحديث السجلات الموجودة
    // هذا يضمن أن البنود المزامنة من المخزون يتم تحديثها ببيانات الحركة
    let savedCount = 0
    let updatedCount = 0
    const batchSize = 100
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const values = batch.map((item: any) => {
        const totalQty = item.totalQty || 0
        const transactionCount = item.transactionCount || 0
        const { movementClass, score } = classifyMovement(transactionCount, totalQty, thresholds)
        
        // حساب تاريخ أول وآخر صرف
        let firstDispatchDate = 'NULL'
        let lastDispatchDate = 'NULL'
        if (item.dates && item.dates.length > 0) {
          const sortedDates = [...item.dates].sort()
          firstDispatchDate = `'${sortedDates[0]}'`
          lastDispatchDate = `'${sortedDates[sortedDates.length - 1]}'`
        }
        
        const id = generateId()
        const genericItemNumber = (item.genericItemNumber || '').replace(/'/g, "''")
        const description = (item.description || '').replace(/'/g, "''").substring(0, 200)
        
        return `(
          '${id}', '${genericItemNumber}', '${description}', '${system}',
          ${totalQty}, ${transactionCount}, ${transactionCount > 0 ? totalQty / transactionCount : 0},
          '${movementClass}', ${score}, ${item.batchCount || 0}, ${item.uniqueExpiryDates || 0}, ${item.uniqueOrders || 0},
          ${periodDays}, '${fileName || 'unknown'}', ${firstDispatchDate}, ${lastDispatchDate}, NOW(), false
        )`
      }).join(',')
      
      try {
        // UPSERT: إدراج جديد أو تحديث الموجود
        const result = await db.$executeRawUnsafe(`
          INSERT INTO "ItemMovement" (
            "id", "genericItemNumber", "description", "system",
            "totalQtyDispatched", "transactionCount", "avgQtyPerTransaction",
            "autoMovementClass", "movementScore", "batchCount", "uniqueExpiryDates", "uniqueOrders",
            "analysisPeriodDays", "reportSource", "firstDispatchDate", "lastDispatchDate", "createdAt", "syncedFromInventory"
          ) VALUES ${values}
          ON CONFLICT ("genericItemNumber", "system") DO UPDATE SET
            "description" = EXCLUDED."description",
            "totalQtyDispatched" = EXCLUDED."totalQtyDispatched",
            "transactionCount" = EXCLUDED."transactionCount",
            "avgQtyPerTransaction" = EXCLUDED."avgQtyPerTransaction",
            "autoMovementClass" = EXCLUDED."autoMovementClass",
            "movementScore" = EXCLUDED."movementScore",
            "batchCount" = EXCLUDED."batchCount",
            "uniqueExpiryDates" = EXCLUDED."uniqueExpiryDates",
            "uniqueOrders" = EXCLUDED."uniqueOrders",
            "analysisPeriodDays" = EXCLUDED."analysisPeriodDays",
            "reportSource" = EXCLUDED."reportSource",
            "firstDispatchDate" = EXCLUDED."firstDispatchDate",
            "lastDispatchDate" = EXCLUDED."lastDispatchDate",
            "syncedFromInventory" = false,
            "updatedAt" = NOW()
        `)
        savedCount += batch.length
        console.log(`Saved batch ${Math.floor(i/batchSize) + 1}, total saved: ${savedCount}`)
      } catch (e: any) {
        console.error('Batch upsert error:', e.message)
      }
    }
    
    // تسجيل التقرير
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO "MovementReportLog" ("id", "fileName", "system", "recordsCount", "itemsCount", "createdAt")
        VALUES ('${generateId()}', '${fileName || 'unknown'}', '${system}', ${totalRecords || 0}, ${items.length}, NOW())
      `)
    } catch (e) {
      console.error('Error logging report:', e)
    }
    
    console.log(`Total saved: ${savedCount} items`)
    
    // لا نحدث المخزون تلقائياً لتجنب الـ timeout
    // المستخدم يمكنه تحديث المخزون يدوياً بضغط زر "تحديث الكميات"
    
    return NextResponse.json({
      success: true,
      message: 'تم تحليل التقرير بنجاح',
      stats: {
        totalRecords: totalRecords || 0,
        uniqueItems: items.length,
        savedItems: savedCount,
        stockUpdated: 0 // يتم التحديث يدوياً
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

// معالجة طلب GET
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const movementClass = searchParams.get('class')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log(`GET movement data for system: ${system}, class: ${movementClass}, search: ${search}`)

    const where: any = { system }

    if (movementClass && movementClass !== 'all') {
      where.autoMovementClass = movementClass
    }

    if (search) {
      where.OR = [
        { genericItemNumber: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

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

    console.log(`Found ${items.length} items, total: ${total}, classCounts: ${classCounts.length}`)

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
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

// معالجة طلب PATCH
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
    
    const currentItem = await db.itemMovement.findFirst({
      where: { genericItemNumber: itemNumber, system }
    })
    
    if (!currentItem) {
      return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })
    }
    
    if (userMovementClass && userMovementClass !== currentItem.userMovementClass) {
      try {
        await db.$executeRawUnsafe(`
          INSERT INTO "ClassificationLog" ("id", "itemNumber", "system", "oldClass", "newClass", "changedBy", "createdAt")
          VALUES ('${generateId()}', '${itemNumber}', '${system}', 
            '${currentItem.userMovementClass || currentItem.autoMovementClass}',
            '${userMovementClass}', '${access.username}', NOW()
          )
        `)
      } catch {
        // تجاهل
      }
    }
    
    await db.$executeRawUnsafe(`
      UPDATE "ItemMovement" 
      SET "userMovementClass" = ${userMovementClass ? `'${userMovementClass}'` : 'NULL'},
          "classifiedBy" = ${userMovementClass ? `'${access.username}'` : 'NULL'},
          "classifiedAt" = ${userMovementClass ? 'NOW()' : 'NULL'},
          "notes" = ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
          "updatedAt" = NOW()
      WHERE "genericItemNumber" = '${itemNumber}' AND "system" = '${system}'
    `)
    
    return NextResponse.json({ success: true, message: 'تم التحديث بنجاح' })
    
  } catch (error: any) {
    console.error('Update movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}
