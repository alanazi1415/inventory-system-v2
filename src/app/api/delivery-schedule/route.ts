import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

// أيام الأسبوع (JavaScript: 0=الأحد, 5=الجمعة, 6=السبت)
const FRIDAY = 5
const SATURDAY = 6

// دالة لحساب تاريخ التوصيل الفعلي مع مراعاة عطلة نهاية الأسبوع
function getEffectiveDeliveryDate(deliveryDay: number, currentMonth: number, currentYear: number): Date {
  // إنشاء تاريخ التوصيل
  let deliveryDate = new Date(currentYear, currentMonth, deliveryDay)
  let dayOfWeek = deliveryDate.getDay()
  
  // إذا صادف يوم الجمعة → التوصيل يوم الخميس (قبل بيوم)
  if (dayOfWeek === FRIDAY) {
    deliveryDate = new Date(currentYear, currentMonth, deliveryDay - 1)
  }
  // إذا صادف يوم السبت → التوصيل يوم الأحد (بعد بيوم)
  else if (dayOfWeek === SATURDAY) {
    // التحقق من أن اليوم التالي لا يزال في نفس الشهر
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    if (deliveryDay + 1 <= daysInMonth) {
      deliveryDate = new Date(currentYear, currentMonth, deliveryDay + 1)
    } else {
      // إذا كان آخر يوم في الشهر، نرجع للشهر التالي
      deliveryDate = new Date(currentYear, currentMonth + 1, 1)
    }
  }
  
  return deliveryDate
}

// دالة للحصول على التاريخ بتوقيت السعودية
function getSaudiDate(): { today: Date; currentDay: number; currentMonth: number; currentYear: number } {
  const now = new Date()
  // تحويل لتوقيت السعودية (UTC+3)
  const saudiOffset = 3 * 60 // 3 ساعات بالدقائق
  const utcOffset = now.getTimezoneOffset() // بالدقائق سالب
  const saudiTime = new Date(now.getTime() + (utcOffset + saudiOffset) * 60 * 1000)
  
  return {
    today: new Date(saudiTime.getFullYear(), saudiTime.getMonth(), saudiTime.getDate()),
    currentDay: saudiTime.getDate(),
    currentMonth: saudiTime.getMonth(),
    currentYear: saudiTime.getFullYear()
  }
}

// دالة لحساب الأيام المتبقية حتى التوصيل مع مراعاة عطلة نهاية الأسبوع
function getDaysUntilDelivery(deliveryDay: number): number {
  const { today, currentDay, currentMonth, currentYear } = getSaudiDate()
  
  // حساب تاريخ التوصيل الفعلي في الشهر الحالي
  let effectiveDate = getEffectiveDeliveryDate(deliveryDay, currentMonth, currentYear)
  
  // إذا كان التاريخ الفعلي قد مر (في الماضي أو اليوم)، نحسب للشهر القادم
  // نستخدم < بدلاً من <= لأننا لا نريد إظهار مراكز موعدها اليوم
  if (effectiveDate < today) {
    // حساب للشهر القادم
    let nextMonth = currentMonth + 1
    let nextYear = currentYear
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear++
    }
    effectiveDate = getEffectiveDeliveryDate(deliveryDay, nextMonth, nextYear)
  }
  
  // حساب الفرق بالأيام
  const diffTime = effectiveDate.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

// جلب جميع المراكز مع التصفية
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'urgent', 'today', 'all'
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let where: any = { isActive: true }
    
    // جلب جميع المراكز
    let centers = await db.deliveryCenter.findMany({
      where,
      orderBy: { deliveryDay: 'asc' },
      take: limit,
      skip: offset
    })

    // إضافة معلومات الأيام المتبقية
    const centersWithDays = centers.map(center => ({
      ...center,
      daysUntilDelivery: getDaysUntilDelivery(center.deliveryDay)
    }))

    // تصفية حسب الفلتر
    let filtered = centersWithDays
    if (filter === 'urgent') {
      // المراكز التي عليها توصيل خلال 48 ساعة أو أقل
      filtered = centersWithDays.filter(c => c.daysUntilDelivery <= 2 && c.daysUntilDelivery >= 0)
    } else if (filter === 'today') {
      // المراكز التي عليها توصيل اليوم
      filtered = centersWithDays.filter(c => c.daysUntilDelivery === 0)
    } else if (filter === 'upcoming') {
      // المراكز التي عليها توصيل خلال أسبوع
      filtered = centersWithDays.filter(c => c.daysUntilDelivery <= 7 && c.daysUntilDelivery > 0)
    }

    // البحث
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(c => 
        c.nameEn.toLowerCase().includes(searchLower) ||
        c.nameAr.includes(search) ||
        c.code.toLowerCase().includes(searchLower)
      )
    }

    // ترتيب حسب الأيام المتبقية
    filtered.sort((a, b) => a.daysUntilDelivery - b.daysUntilDelivery)

    const total = await db.deliveryCenter.count({ where })

    return NextResponse.json({
      success: true,
      centers: filtered,
      total,
      stats: {
        total: centersWithDays.length,
        urgent: centersWithDays.filter(c => c.daysUntilDelivery <= 2 && c.daysUntilDelivery >= 0).length,
        today: centersWithDays.filter(c => c.daysUntilDelivery === 0).length,
        upcoming: centersWithDays.filter(c => c.daysUntilDelivery <= 7 && c.daysUntilDelivery > 0).length
      }
    })

  } catch (error: any) {
    console.error('Get delivery schedule error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في جلب جدول التوصيل',
      details: error.message
    }, { status: 500 })
  }
}

// رفع ملف جدول التوصيل
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { items, clearExisting } = body

    console.log('Received request:', {
      itemsCount: items?.length,
      clearExisting,
      firstItem: items?.[0]
    })

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('No items found in request')
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    // حذف البيانات القديمة إذا طُلب
    if (clearExisting) {
      console.log('Clearing existing delivery centers...')
      await db.deliveryCenter.deleteMany({})
    }

    let addedCount = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        // استخراج رقم اليوم من النص (مثال: "Day 1 of every month" -> 1)
        let deliveryDay = item.deliveryDay
        if (typeof deliveryDay === 'string') {
          const match = deliveryDay.match(/Day (\d+)/i)
          if (match) {
            deliveryDay = parseInt(match[1])
          }
        }

        if (!item.nameEn || !item.nameAr || !deliveryDay) {
          console.log('Skipping invalid item:', item)
          continue
        }

        await db.deliveryCenter.create({
          data: {
            nameEn: String(item.nameEn).trim(),
            nameAr: String(item.nameAr).trim(),
            code: String(item.code || '').trim(),
            deliveryDay: Number(deliveryDay),
            deliveryDayEn: String(item.deliveryDayEn || item.deliveryDay || '').trim(),
            deliveryDayAr: String(item.deliveryDayAr || '').trim(),
            isActive: true
          }
        })
        addedCount++
      } catch (error: any) {
        console.error(`Error adding center ${item.nameEn}:`, error.message)
        errors.push(`${item.nameEn}: ${error.message}`)
      }
    }

    console.log(`Added ${addedCount} delivery centers`)

    return NextResponse.json({
      success: true,
      message: 'تم رفع جدول التوصيل بنجاح',
      stats: {
        itemsProcessed: items.length,
        centersAdded: addedCount,
        errors: errors.length
      }
    })

  } catch (error: any) {
    console.error('Upload delivery schedule error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في رفع جدول التوصيل',
      details: error.message
    }, { status: 500 })
  }
}

// تحديث موافقة على مركز
export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { id, approvedBy, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'معرف المركز مطلوب' }, { status: 400 })
    }

    const center = await db.deliveryCenter.update({
      where: { id },
      data: {
        lastApproved: new Date(),
        approvedBy: approvedBy || 'admin',
        notes: notes || null
      }
    })

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل الموافقة',
      center
    })

  } catch (error: any) {
    console.error('Update delivery center error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في التحديث',
      details: error.message
    }, { status: 500 })
  }
}

// حذف مركز
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف المركز مطلوب' }, { status: 400 })
    }

    await db.deliveryCenter.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'تم حذف المركز'
    })

  } catch (error: any) {
    console.error('Delete delivery center error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في الحذف',
      details: error.message
    }, { status: 500 })
  }
}
