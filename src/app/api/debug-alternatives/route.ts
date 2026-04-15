import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    // 4. إذا كان البند أصلي، نتحقق من بدائله
    if (asOriginal.length > 0) {
      const groupId = asOriginal[0].id
      const alternatives = await db.$queryRaw`
        SELECT * FROM "AlternativeItem"
        WHERE "groupId" = ${groupId}
        ORDER BY "sortOrder"
      ` as any[]
      
      results.checks.alternatives = {
        count: alternatives.length,
        items: alternatives
      }

      // 5. التحقق من مخزون البدائل
      if (alternatives.length > 0) {
        const altNumbers = alternatives.map((a: any) => a.itemNumber)
        const altStock = await db.$queryRaw`
          SELECT "genericItemNumber", SUM("availableQty") as "availableQty"
          FROM "InventoryItem"
          WHERE "genericItemNumber" IN (${altNumbers.map(n => `'${n}'`).join(',')})
          AND "system" = ${system}
          AND "daysToExpire" > 0
          GROUP BY "genericItemNumber"
        ` as any[]
        
        results.checks.alternativesStock = {
          stockData: altStock,
          summary: alternatives.map((a: any) => {
            const stock = altStock.find((s: any) => s.genericItemNumber === a.itemNumber)
            return {
              itemNumber: a.itemNumber,
              availableQty: stock?.availableQty || 0
            }
          })
        }
      }
    }

    // 6. عرض عينة من البيانات
    const sampleGroups = await db.$queryRaw`
      SELECT * FROM "AlternativeGroup" LIMIT 5
    ` as any[]
    
    const sampleItems = await db.$queryRaw`
      SELECT * FROM "AlternativeItem" LIMIT 10
    ` as any[]

    results.sample = {
      groups: sampleGroups,
      items: sampleItems
    }

    // 7. إحصائيات عامة
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
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
