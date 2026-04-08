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
    const urgencyFilter = searchParams.get('urgency') // حرج، عالي، متوسط، منخفض
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const recalculate = searchParams.get('recalculate') === 'true'

    // جلب إعدادات الحدود
    const thresholds = await db.movementThresholds.findUnique({
      where: { system }
    })
    
    const settings = thresholds ? {
      topUpDaysToAnalyze: thresholds.topUpDaysToAnalyze,
      topUpSafetyFactor: thresholds.topUpSafetyFactor,
      topUpMinStockDays: thresholds.topUpMinStockDays
    } : DEFAULT_SETTINGS

    // إذا طُلب إعادة الحساب
    if (recalculate) {
      await calculateTopUpSuggestions(system, settings)
    }

    // جلب الاقتراحات
    const where: any = { system }
    if (urgencyFilter && urgencyFilter !== 'all') {
      where.urgencyLevel = urgencyFilter
    }

    const [suggestions, total, urgencyCounts] = await Promise.all([
      db.topUpSuggestion.findMany({
        where,
        orderBy: [
          { urgencyLevel: 'asc' }, // حرج أولاً
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
async function calculateTopUpSuggestions(system: string, settings: typeof DEFAULT_SETTINGS) {
  console.log(`Calculating TOP UP suggestions for ${system}...`)
  
  const { topUpDaysToAnalyze, topUpSafetyFactor, topUpMinStockDays } = settings
  
  // تاريخ بداية التحليل
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - topUpDaysToAnalyze)
  
  // جلب بيانات الحركة للمستودع
  const movements = await db.itemMovement.findMany({
    where: {
      system,
      lastDispatchDate: {
        gte: startDate
      }
    }
  })
  
  console.log(`Found ${movements.length} items with recent movement`)
  
  // جلب المخزون الحالي
  const inventory = await db.inventoryItem.findMany({
    where: { system }
  })
  
  // إنشاء خريطة للمخزون
  const inventoryMap = new Map<string, {
    totalQty: number
    availableQty: number
    description: string | null
  }>()
  
  for (const item of inventory) {
    const numbers = [
      item.genericItemNumber,
      item.customerItemNumber,
      item.tradeItemNumber
    ].filter((n): n is string => Boolean(n && n.trim()))
    
    for (const num of numbers) {
      inventoryMap.set(num, {
        totalQty: item.totalQty,
        availableQty: item.availableQty,
        description: item.genericItemDescription
      })
    }
  }
  
  // حساب الاقتراحات
  let calculated = 0
  let updated = 0
  
  for (const movement of movements) {
    const itemNumber = movement.genericItemNumber
    const inventoryData = inventoryMap.get(itemNumber)
    
    if (!inventoryData) continue // البند ليس في المخزون
    
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
    // الكمية = (أيام المخزون المطلوبة × متوسط الاستهلاك اليومي × معامل الأمان) - المخزون المتاح
    const targetStock = topUpMinStockDays * avgDailyConsumption * topUpSafetyFactor
    const suggestedQty = Math.max(0, targetStock - inventoryData.availableQty)
    
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
          daysOfStock,
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
          daysOfStock,
          suggestedQty,
          urgencyLevel,
          analysisPeriodDays: topUpDaysToAnalyze
        }
      })
      updated++
    } catch (e) {
      console.error(`Error upserting suggestion for ${itemNumber}:`, e)
    }
    
    calculated++
  }
  
  // حذف الاقتراحات القديمة للبنود التي لم تعد تحتاج تغذية
  // (البند لديه مخزون كافٍ الآن)
  const allSuggestions = await db.topUpSuggestion.findMany({
    where: { system }
  })
  
  for (const suggestion of allSuggestions) {
    // التحقق من المخزون الحالي
    const inventoryData = inventoryMap.get(suggestion.genericItemNumber)
    
    if (!inventoryData) {
      // البند لم يعد في المخزون - احذف الاقتراح
      await db.topUpSuggestion.delete({
        where: { id: suggestion.id }
      }).catch(() => {})
      continue
    }
    
    // إذا كان المخزون كافياً، احذف الاقتراح
    if (inventoryData.availableQty >= suggestion.suggestedQty + inventoryData.availableQty) {
      await db.topUpSuggestion.delete({
        where: { id: suggestion.id }
      }).catch(() => {})
    }
  }
  
  console.log(`TOP UP calculation complete: ${calculated} items analyzed, ${updated} suggestions updated`)
  
  return { calculated, updated }
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
    const thresholds = await db.movementThresholds.findUnique({
      where: { system }
    })
    
    const settings = thresholds ? {
      topUpDaysToAnalyze: thresholds.topUpDaysToAnalyze,
      topUpSafetyFactor: thresholds.topUpSafetyFactor,
      topUpMinStockDays: thresholds.topUpMinStockDays
    } : DEFAULT_SETTINGS

    const result = await calculateTopUpSuggestions(system, settings)

    return NextResponse.json({
      success: true,
      message: 'تم حساب اقتراحات التغذية',
      stats: result
    })
  } catch (error: any) {
    console.error('Calculate TOP UP error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في حساب الاقتراحات',
      details: error.message 
    }, { status: 500 })
  }
}
