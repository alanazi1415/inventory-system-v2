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

// جلب جميع البدائل
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemNumber = searchParams.get('itemNumber')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (itemNumber) {
      // جلب البدائل لبند محدد
      const groups = await db.alternativeGroup.findMany({
        where: { 
          itemNumber,
          isActive: true 
        },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      })

      // جلب معلومات المخزون للبدائل
      const allAlternativeNumbers = groups.flatMap(g => g.items.map(i => i.itemNumber))
      const stockInfo = await db.inventoryItem.groupBy({
        by: ['genericItemNumber'],
        where: {
          genericItemNumber: { in: allAlternativeNumbers }
        },
        _sum: {
          availableQty: true
        }
      })

      const stockMap = new Map(stockInfo.map(s => [s.genericItemNumber, s._sum.availableQty || 0]))

      const result = groups.map(group => ({
        ...group,
        items: group.items.map(item => ({
          ...item,
          availableStock: stockMap.get(item.itemNumber) || 0
        }))
      }))

      return NextResponse.json({
        success: true,
        alternatives: result
      })
    }

    // جلب جميع البدائل مع البحث
    const where: any = { isActive: true }
    if (search) {
      where.OR = [
        { itemNumber: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [groups, total] = await Promise.all([
      db.alternativeGroup.findMany({
        where,
        include: {
          items: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.alternativeGroup.count({ where })
    ])

    return NextResponse.json({
      success: true,
      groups,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error: any) {
    console.error('Get alternatives error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في جلب البدائل',
      details: error.message
    }, { status: 500 })
  }
}

// رفع ملف البدائل
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { items, clearExisting } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    console.log(`Processing ${items.length} alternative items`)

    // حذف البيانات القديمة إذا طُلب
    if (clearExisting) {
      console.log('Clearing existing alternatives...')
      await db.alternativeItem.deleteMany({})
      await db.alternativeGroup.deleteMany({})
    }

    // تجميع البدائل حسب البند الأصلي
    const alternativesMap = new Map<string, {
      description: string
      alternatives: string[]
    }>()

    for (const item of items) {
      const itemNumber = String(item.itemNumber || '').trim()
      const description = String(item.description || '').trim()
      const alternativeStr = String(item.alternatives || '').trim()

      if (!itemNumber || !alternativeStr) continue

      // فصل البدائل بعلامة +
      const alternatives = alternativeStr
        .split('+')
        .map(a => a.trim())
        .filter(a => a.length > 0)

      if (alternatives.length === 0) continue

      alternativesMap.set(itemNumber, {
        description,
        alternatives
      })
    }

    console.log(`Found ${alternativesMap.size} unique items with alternatives`)

    // إدخال البيانات
    let addedGroups = 0
    let addedItems = 0

    for (const [itemNumber, data] of alternativesMap.entries()) {
      try {
        // إنشاء مجموعة بديلة
        const group = await db.alternativeGroup.create({
          data: {
            itemNumber,
            description: data.description || null,
            isActive: true
          }
        })

        // إضافة البنود البديلة
        for (let i = 0; i < data.alternatives.length; i++) {
          await db.alternativeItem.create({
            data: {
              groupId: group.id,
              itemNumber: data.alternatives[i],
              sortOrder: i + 1
            }
          })
          addedItems++
        }

        addedGroups++
      } catch (error) {
        console.error(`Error adding alternatives for ${itemNumber}:`, error)
      }
    }

    console.log(`Added ${addedGroups} groups with ${addedItems} alternative items`)

    return NextResponse.json({
      success: true,
      message: 'تم رفع البدائل بنجاح',
      stats: {
        itemsProcessed: items.length,
        groupsCreated: addedGroups,
        alternativesCreated: addedItems
      }
    })

  } catch (error: any) {
    console.error('Upload alternatives error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في رفع البدائل',
      details: error.message
    }, { status: 500 })
  }
}

// حذف مجموعة بديلة
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف المجموعة مطلوب' }, { status: 400 })
    }

    // حذف البنود البديلة أولاً ثم المجموعة
    await db.alternativeItem.deleteMany({
      where: { groupId: id }
    })

    await db.alternativeGroup.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'تم حذف المجموعة البديلة'
    })

  } catch (error: any) {
    console.error('Delete alternative error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في الحذف',
      details: error.message
    }, { status: 500 })
  }
}
