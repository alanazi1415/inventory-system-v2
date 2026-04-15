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
    const system = searchParams.get('system') || 'hoz'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('=== GET Alternatives ===')
    console.log({ itemNumber, search, system, limit, offset })

    // استخدام Raw SQL للجلب
    let groupsQuery: any[]
    
    if (itemNumber) {
      // جلب البدائل لبند محدد
      groupsQuery = await db.$queryRaw`
        SELECT * FROM "AlternativeGroup" 
        WHERE "itemNumber" = ${itemNumber} AND "isActive" = true
        ORDER BY "createdAt" DESC
      ` as any[]
    } else {
      // جلب جميع البدائل
      if (search) {
        groupsQuery = await db.$queryRaw`
          SELECT * FROM "AlternativeGroup" 
          WHERE "isActive" = true 
          AND ("itemNumber" LIKE ${'%' + search + '%'} OR description LIKE ${'%' + search + '%'})
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as any[]
      } else {
        groupsQuery = await db.$queryRaw`
          SELECT * FROM "AlternativeGroup" 
          WHERE "isActive" = true
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as any[]
      }
    }

    console.log(`Found ${groupsQuery.length} groups`)

    if (groupsQuery.length === 0) {
      return NextResponse.json({
        success: true,
        groups: [],
        total: 0,
        page: 1,
        totalPages: 0
      })
    }

    // جلب الـ items لكل مجموعة - استخدام unsafe مع quotes صحيحة
    const groupIds = groupsQuery.map((g: any) => g.id)
    const groupIdsList = groupIds.map(id => `'${id}'`).join(',')
    
    console.log(`Fetching items for groupIds: ${groupIdsList.substring(0, 100)}...`)
    
    const itemsQuery = await db.$queryRawUnsafe(`
      SELECT * FROM "AlternativeItem" 
      WHERE "groupId" IN (${groupIdsList})
      ORDER BY "sortOrder" ASC
    `) as any[]

    console.log(`Found ${itemsQuery.length} alternative items`)

    // جمع كل أرقام البنود (الأصلية + البدائل)
    const originalItemNumbers = groupsQuery.map((g: any) => g.itemNumber)
    const alternativeItemNumbers = itemsQuery.map((item: any) => item.itemNumber)
    const allItemNumbers = [...new Set([...originalItemNumbers, ...alternativeItemNumbers])]
    
    console.log(`Checking stock for ${allItemNumbers.length} item numbers`)
    
    // جلب المخزون لجميع البنود
    let stockMap = new Map<string, number>()
    if (allItemNumbers.length > 0) {
      try {
        const itemNumbersList = allItemNumbers.map(n => `'${n}'`).join(',')
        
        const stockQuery = await db.$queryRawUnsafe(`
          SELECT "genericItemNumber", SUM("availableQty") as "availableQty"
          FROM "InventoryItem"
          WHERE "genericItemNumber" IN (${itemNumbersList})
          AND "system" = '${system}'
          AND "daysToExpire" > 0
          GROUP BY "genericItemNumber"
        `) as any[]
        
        console.log(`Stock query returned ${stockQuery.length} items`)
        
        for (const row of stockQuery) {
          stockMap.set(row.genericItemNumber, Number(row.availableQty) || 0)
        }
        
        // طباعة عينة من بيانات المخزون
        console.log('Sample stock data:', 
          [...stockMap.entries()].slice(0, 5).map(([k, v]) => `${k}: ${v}`)
        )
      } catch (e: any) {
        console.log('Could not fetch stock info:', e.message)
      }
    }

    // تجميع الـ items حسب groupId
    const itemsMap = new Map<string, any[]>()
    for (const item of itemsQuery) {
      if (!itemsMap.has(item.groupId)) {
        itemsMap.set(item.groupId, [])
      }
      itemsMap.get(item.groupId)!.push({
        id: item.id,
        itemNumber: item.itemNumber,
        sortOrder: item.sortOrder,
        availableStock: stockMap.get(item.itemNumber) || 0
      })
    }

    // بناء النتيجة مع إضافة مخزون البند الأصلي
    const groups = groupsQuery.map((g: any) => ({
      id: g.id,
      itemNumber: g.itemNumber,
      description: g.description,
      isActive: g.isActive,
      originalStock: stockMap.get(g.itemNumber) || 0,
      items: itemsMap.get(g.id) || []
    }))

    // طباعة عينة من النتائج
    console.log('Sample results:', groups.slice(0, 2).map(g => ({
      itemNumber: g.itemNumber,
      originalStock: g.originalStock,
      alternativesCount: g.items.length,
      alternatives: g.items.map(i => `${i.itemNumber}: ${i.availableStock}`)
    })))

    // جلب العدد الإجمالي
    const countResult = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "AlternativeGroup" WHERE "isActive" = true
    ` as any[]
    const total = parseInt(countResult[0]?.count || '0')

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
      success: false,
      error: 'حدث خطأ في جلب البدائل',
      details: error.message,
      groups: [],
      total: 0
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

    console.log('=== Alternatives Upload ===')
    console.log('Received request:', {
      itemsCount: items?.length,
      clearExisting,
      firstItem: items?.[0],
      lastItem: items?.[items?.length - 1]
    })

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('ERROR: No items found in request')
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    // التحقق من صحة البيانات
    const validItems = items.filter((item: any) => {
      const hasItemNumber = item.itemNumber && String(item.itemNumber).trim().length > 0
      const hasAlternatives = item.alternatives && String(item.alternatives).trim().length > 0
      return hasItemNumber && hasAlternatives
    })
    
    console.log(`Valid items: ${validItems.length} out of ${items.length}`)
    
    if (validItems.length === 0) {
      console.log('ERROR: No valid items after filtering')
      return NextResponse.json({ 
        error: 'لا توجد بيانات صالحة',
        details: 'تأكد من أن الملف يحتوي على أرقام بنود في العامود الأول وبدائل في العامود الثالث'
      }, { status: 400 })
    }

    console.log(`Processing ${validItems.length} valid alternative items`)

    // التحقق من وجود الجداول
    try {
      const tablesCheck = await db.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('AlternativeGroup', 'AlternativeItem')
      ` as any[]
      console.log('Tables check:', tablesCheck)
      if (tablesCheck.length < 2) {
        console.log('Tables missing, attempting to create...')
        // إنشاء الجداول إذا لم تكن موجودة
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AlternativeGroup" (
            "id" TEXT NOT NULL,
            "itemNumber" TEXT NOT NULL,
            "description" TEXT,
            "notes" TEXT,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AlternativeGroup_pkey" PRIMARY KEY ("id")
          )
        `)
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AlternativeItem" (
            "id" TEXT NOT NULL,
            "groupId" TEXT NOT NULL,
            "itemNumber" TEXT NOT NULL,
            "description" TEXT,
            "sortOrder" INTEGER NOT NULL DEFAULT 1,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AlternativeItem_pkey" PRIMARY KEY ("id")
          )
        `)
        console.log('Tables created successfully')
      }
    } catch (tableError: any) {
      console.error('Error checking/creating tables:', tableError)
      return NextResponse.json({ 
        error: 'خطأ في التحقق من الجداول',
        details: tableError.message 
      }, { status: 500 })
    }

    // حذف البيانات القديمة إذا طُلب
    if (clearExisting) {
      console.log('Clearing existing alternatives...')
      try {
        await db.alternativeItem.deleteMany({})
        await db.alternativeGroup.deleteMany({})
        console.log('Existing data cleared')
      } catch (clearError: any) {
        console.error('Error clearing existing data:', clearError)
        // متابعة حتى لو فشل الحذف
      }
    }

    // تجميع البدائل حسب البند الأصلي
    const alternativesMap = new Map<string, {
      description: string
      alternatives: string[]
    }>()

    for (const item of validItems) {
      const itemNumber = String(item.itemNumber || '').trim()
      const description = String(item.description || '').trim()
      const alternativeStr = String(item.alternatives || '').trim()

      if (!itemNumber || !alternativeStr) continue

      // فصل البدائل بعلامة +
      const newAlternatives = alternativeStr
        .split('+')
        .map(a => a.trim())
        .filter(a => a.length > 0)

      if (newAlternatives.length === 0) continue

      console.log(`Item ${itemNumber}: ${newAlternatives.length} alternatives [${newAlternatives.join(', ')}]`)

      // دمج البدائل إذا كان البند موجود مسبقاً
      if (alternativesMap.has(itemNumber)) {
        const existing = alternativesMap.get(itemNumber)!
        // إضافة البدائل الجديدة فقط (بدون تكرار)
        for (const alt of newAlternatives) {
          if (!existing.alternatives.includes(alt)) {
            existing.alternatives.push(alt)
          }
        }
      } else {
        alternativesMap.set(itemNumber, {
          description,
          alternatives: newAlternatives
        })
      }
    }

    console.log(`Found ${alternativesMap.size} unique items with alternatives`)

    // إدخال البيانات
    let addedGroups = 0
    let addedItems = 0
    const errors: string[] = []

    // إنشاء معرفات فريدة
    const generateId = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let result = 'c'
      for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }

    for (const [itemNumber, data] of alternativesMap.entries()) {
      try {
        const groupId = generateId()
        
        // إنشاء مجموعة بديلة باستخدام SQL مباشرة
        await db.$executeRawUnsafe(`
          INSERT INTO "AlternativeGroup" (id, "itemNumber", description, "isActive", "createdAt", "updatedAt")
          VALUES ('${groupId}', '${itemNumber}', ${data.description ? `'${data.description.replace(/'/g, "''")}'` : 'NULL'}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)

        // إضافة البنود البديلة
        for (let i = 0; i < data.alternatives.length; i++) {
          const itemId = generateId()
          await db.$executeRawUnsafe(`
            INSERT INTO "AlternativeItem" (id, "groupId", "itemNumber", "sortOrder", "createdAt")
            VALUES ('${itemId}', '${groupId}', '${data.alternatives[i]}', ${i + 1}, CURRENT_TIMESTAMP)
          `)
          addedItems++
        }

        addedGroups++
      } catch (error: any) {
        console.error(`Error adding alternatives for ${itemNumber}:`, error)
        errors.push(`${itemNumber}: ${error.message}`)
      }
    }

    console.log(`Added ${addedGroups} groups with ${addedItems} alternative items`)
    if (errors.length > 0) {
      console.log(`Errors (${errors.length}):`, errors.slice(0, 5))
    }

    return NextResponse.json({
      success: true,
      message: 'تم رفع البدائل بنجاح',
      stats: {
        itemsReceived: items.length,
        validItems: validItems.length,
        groupsCreated: addedGroups,
        alternativesCreated: addedItems,
        errorsCount: errors.length,
        errors: errors.slice(0, 10) // أول 10 أخطاء فقط
      }
    })

  } catch (error: any) {
    console.error('Upload alternatives error:', error)
    return NextResponse.json({
      error: 'حدث خطأ في رفع البدائل',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
