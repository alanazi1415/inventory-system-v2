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

// دالة لحساب الأيام المتبقية حتى التوصيل
function getDaysUntilDelivery(deliveryDay: number): number {
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // إذا كان يوم التوصيل في الشهر الحالي لم يمر بعد
  if (deliveryDay > currentDay) {
    return deliveryDay - currentDay
  }
  
  // إذا كان يوم التوصيل قد مر، نحسب للشهر القادم
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const remainingDaysInMonth = daysInCurrentMonth - currentDay
  return remainingDaysInMonth + deliveryDay
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
