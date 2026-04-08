import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن أو مستخدم مصرح له
async function checkAccess(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    
    // تحقق من صلاحية الأدمن
    const adminSession = cookieStore.get('admin_session')
    if (adminSession?.value) {
      const session = await db.adminSession.findUnique({
        where: { token: adminSession.value }
      })
      if (session && session.expiresAt > new Date()) {
        return true
      }
    }
    
    // تحقق من صلاحية المستخدم
    const userSession = cookieStore.get('user_session')
    if (userSession?.value) {
      const session = await db.userSession.findUnique({
        where: { token: userSession.value },
        include: { user: true }
      })
      if (session && session.expiresAt > new Date() && session.user.isActive) {
        return !!session.user.canViewMovement
      }
    }
    
    return false
  } catch (error) {
    console.error('Access check error:', error)
    return false
  }
}

// القيم الافتراضية
const DEFAULT_SETTINGS = {
  topUpDaysToAnalyze: 90,
  topUpSafetyFactor: 1.5,
  topUpMinStockDays: 30
}

// حساب اقتراحات التغذية
export async function GET(request: NextRequest) {
  try {
    const hasAccess = await checkAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'
    const urgencyFilter = searchParams.get('urgency')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const recalculate = searchParams.get('recalculate') === 'true'

    // جلب إعدادات الحدود
    let settings = DEFAULT_SETTINGS
    try {
      const thresholds = await db.movementThresholds.findUnique({
        where: { system }
      })
      if (thresholds) {
        settings = {
          topUpDaysToAnalyze: thresholds.topUpDaysToAnalyze,
          topUpSafetyFactor: thresholds.topUpSafetyFactor,
          topUpMinStockDays: thresholds.topUpMinStockDays
        }
      }
    } catch (e) {
      console.log('Thresholds table might not exist yet, using defaults')
    }

    // إذا طُلب إعادة الحساب
    if (recalculate) {
      const result = await calculateTopUpSuggestions(system, settings)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    }

    // جلب الاقتراحات
    const where: any = { system }
    if (urgencyFilter && urgencyFilter !== 'all') {
      where.urgencyLevel = urgencyFilter
    }

    let suggestions: any[] = []
    let total = 0
    let urgencyCounts: any[] = []

    try {
      [suggestions, total, urgencyCounts] = await Promise.all([
        db.topUpSuggestion.findMany({
          where,
          orderBy: [
            { urgencyLevel: 'asc' },
            { daysOfStock: 'asc' }
          ],
          take: limit,
          skip: offset
        }),
        db.topUpSuggestion.count({ where }),
        db.topUpSuggestion.groupBy({
          by: ['urgencyLevel'],
          where: { system },
          _count: { id: true }
        })
      ])
    } catch (e: any) {
      // الجدول قد لا يكون موجوداً
      console.log('TopUpSuggestion table might not exist:', e.message)
    }

    return NextResponse.json({
      success: true,
      suggestions,
      total,
      urgencyCounts: urgencyCounts.map(c => ({
        level: c.urgencyLevel,
        count: c._count.id
      })),
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
      settings
    })
  } catch (error: any) {
    console.error('Get top-up suggestions error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ',
      details: error.message 
    }, { status: 500 })
  }
}

// حساب اقتراحات التغذية
async function calculateTopUpSuggestions(system: string, settings: typeof DEFAULT_SETTINGS): Promise<{ success: boolean; error?: string; calculated?: number; updated?: number }> {
  console.log(`Calculating TOP UP suggestions for ${system}...`)
  
  const { topUpDaysToAnalyze, topUpSafetyFactor, topUpMinStockDays } = settings
  
  try {
    // تاريخ بداية التحليل
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - topUpDaysToAnalyze)
    
    // جلب بيانات الحركة للمستودع
    const movements = await db.itemMovement.findMany({
      where: {
        system,
        totalQtyDispatched: { gt: 0 } // فقط البنود التي لها صرف
      }
    })
    
    console.log(`Found ${movements.length} items with dispatch records`)
    
    // جلب المخزون الحالي - نركز على Generic Item Number
    const inventory = await db.inventoryItem.findMany({
      where: { system }
    })
    
    console.log(`Found ${inventory.length} items in inventory`)
    
    // إنشاء خريطة للمخزون باستخدام Generic Item Number كمفتاح رئيسي
    const inventoryMap = new Map<string, {
      totalQty: number
      availableQty: number
      description: string | null
    }>()
    
    for (const item of inventory) {
      // نركز على Generic Item Number كالمفتاح الرئيسي
      if (item.genericItemNumber && item.genericItemNumber.trim()) {
        const key = item.genericItemNumber.trim()
        // لا نستبدل إذا كان موجوداً مسبقاً (نحتفظ بالأول)
        if (!inventoryMap.has(key)) {
          inventoryMap.set(key, {
            totalQty: item.totalQty,
            availableQty: item.availableQty,
            description: item.genericItemDescription
          })
        }
      }
    }
    
    console.log(`Created inventory map with ${inventoryMap.size} unique Generic Item Numbers`)
    
    // حساب الاقتراحات
    let calculated = 0
    let updated = 0
    const errors: string[] = []
    
    for (const movement of movements) {
      const itemNumber = movement.genericItemNumber.trim()
      
      // البحث في المخزون باستخدام Generic Item Number
      const inventoryData = inventoryMap.get(itemNumber)
      
      if (!inventoryData) {
        // البند له صرف لكن ليس في المخزون حالياً - نتخطاه
        continue
      }
      
      // حساب متوسط الاستهلاك اليومي
      const daysWithMovement = movement.daysSpan || 1
      const avgDailyConsumption = movement.totalQtyDispatched / Math.max(daysWithMovement, 1)
      
      if (avgDailyConsumption <= 0) continue
      
      // حساب أيام المخزون المتبقية
      const daysOfStock = inventoryData.availableQty / avgDailyConsumption
      
      // تحديد مستوى الإلحاح
      let urgencyLevel: string
      if (daysOfStock <= 7) {
        urgencyLevel = 'حرج'
      } else if (daysOfStock <= 15) {
        urgencyLevel = 'عالي'
      } else if (daysOfStock <= topUpMinStockDays) {
        urgencyLevel = 'متوسط'
      } else {
        urgencyLevel = 'منخفض'
      }
      
      // حساب الكمية المقترحة
      const targetStock = topUpMinStockDays * avgDailyConsumption * topUpSafetyFactor
      const suggestedQty = Math.max(0, Math.ceil(targetStock - inventoryData.availableQty))
      
      if (suggestedQty <= 0) continue // لا يحتاج تغذية
      
      try {
        await db.topUpSuggestion.upsert({
          where: {
            genericItemNumber_system: {
              genericItemNumber: itemNumber,
              system
            }
          },
          update: {
            description: inventoryData.description || movement.description,
            currentStock: inventoryData.totalQty,
            availableStock: inventoryData.availableQty,
            avgDailyConsumption,
            daysOfStock: Math.round(daysOfStock * 10) / 10,
            suggestedQty,
            urgencyLevel,
            calculationDate: new Date(),
            analysisPeriodDays: topUpDaysToAnalyze
          },
          create: {
            genericItemNumber: itemNumber,
            description: inventoryData.description || movement.description,
            system,
            currentStock: inventoryData.totalQty,
            availableStock: inventoryData.availableQty,
            avgDailyConsumption,
            daysOfStock: Math.round(daysOfStock * 10) / 10,
            suggestedQty,
            urgencyLevel,
            analysisPeriodDays: topUpDaysToAnalyze
          }
        })
        updated++
      } catch (e: any) {
        errors.push(`${itemNumber}: ${e.message}`)
      }
      
      calculated++
    }
    
    console.log(`TOP UP calculation complete: ${calculated} items analyzed, ${updated} suggestions saved`)
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`)
    }
    
    return { success: true, calculated, updated }
  } catch (error: any) {
    console.error('Calculate TOP UP error:', error)
    return { success: false, error: error.message }
  }
}

// طلب إعادة الحساب
export async function POST(request: NextRequest) {
  try {
    const hasAccess = await checkAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const system = body.system || 'mwsal'

    // جلب الإعدادات
    let settings = DEFAULT_SETTINGS
    try {
      const thresholds = await db.movementThresholds.findUnique({
        where: { system }
      })
      if (thresholds) {
        settings = {
          topUpDaysToAnalyze: thresholds.topUpDaysToAnalyze,
          topUpSafetyFactor: thresholds.topUpSafetyFactor,
          topUpMinStockDays: thresholds.topUpMinStockDays
        }
      }
    } catch (e) {
      console.log('Using default settings')
    }

    const result = await calculateTopUpSuggestions(system, settings)

    if (!result.success) {
      return NextResponse.json({ 
        error: 'حدث خطأ في حساب الاقتراحات',
        details: result.error 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'تم حساب اقتراحات التغذية',
      stats: {
        calculated: result.calculated,
        updated: result.updated
      }
    })
  } catch (error: any) {
    console.error('Calculate TOP UP error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في حساب الاقتراحات',
      details: error.message 
    }, { status: 500 })
  }
}
