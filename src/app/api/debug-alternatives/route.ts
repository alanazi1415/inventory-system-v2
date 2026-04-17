import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (!session?.value) return false
    
    const adminSession = await db.adminSession.findUnique({
      where: { token: session.value }
    })
    
    return !!(adminSession && adminSession.expiresAt > new Date())
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  // منع الوصول في الإنتاج
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const itemNumber = searchParams.get('itemNumber')
  const system = searchParams.get('system') || 'hoz'

  try {
    const results: any = {
      itemNumber,
      system,
      checks: {}
    }

    // 1. التحقق من وجود البند في المخزون
    const inventoryCheck = await db.$queryRaw`
      SELECT "genericItemNumber", "availableQty", "system"
      FROM "InventoryItem"
      WHERE "genericItemNumber" = ${itemNumber}
      AND "system" = ${system}
    ` as any[]
    results.checks.inventory = {
      found: inventoryCheck.length > 0,
      records: inventoryCheck
    }

    // 2. التحقق من وجود البند في جدول البدائل (كبند أصلي)
    const asOriginal = await db.$queryRaw`
      SELECT * FROM "AlternativeGroup"
      WHERE "itemNumber" = ${itemNumber}
    ` as any[]
    results.checks.asOriginal = {
      found: asOriginal.length > 0,
      groups: asOriginal
    }

    // 3. التحقق من وجود البند كبدیل
    const asAlternative = await db.$queryRaw`
      SELECT ai.*, ag."itemNumber" as "originalItemNumber"
      FROM "AlternativeItem" ai
      JOIN "AlternativeGroup" ag ON ai."groupId" = ag.id
      WHERE ai."itemNumber" = ${itemNumber}
    ` as any[]
    results.checks.asAlternative = {
      found: asAlternative.length > 0,
      items: asAlternative
    }

    // 4. إحصائيات عامة
    const groupCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "AlternativeGroup"
    ` as any[]
    const itemCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "AlternativeItem"
    ` as any[]
    
    results.stats = {
      totalGroups: groupCount[0]?.count || 0,
      totalItems: itemCount[0]?.count || 0
    }

    return NextResponse.json(results)

  } catch (error: any) {
    console.error('Debug alternatives error:', error)
    return NextResponse.json({
      error: 'حدث خطأ',
      code: 'QUERY_ERROR'
    }, { status: 500 })
  }
}
