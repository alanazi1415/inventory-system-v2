import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: any = {}

    // 1. التحقق من جداول الحركة
    try {
      const movementCount = await db.itemMovement.count()
      results.itemMovement = { exists: true, count: movementCount }
    } catch (e: any) {
      results.itemMovement = { exists: false, error: e.message }
    }

    // 2. التحقق من جدول إعدادات الحدود
    try {
      const thresholds = await db.movementThresholds.findMany()
      results.movementThresholds = { exists: true, count: thresholds.length, data: thresholds }
    } catch (e: any) {
      results.movementThresholds = { exists: false, error: e.message }
    }

    // 3. التحقق من جدول سجل التصنيف
    try {
      const classificationLogCount = await db.classificationLog.count()
      results.classificationLog = { exists: true, count: classificationLogCount }
    } catch (e: any) {
      results.classificationLog = { exists: false, error: e.message }
    }

    // 4. التحقق من المستخدم nupco وصلاحياته
    try {
      const nupcoUser = await db.user.findUnique({
        where: { username: 'nupco' },
        select: {
          id: true,
          username: true,
          name: true,
          canViewMovement: true,
          canEditMovementSettings: true,
          canClassifyMovement: true
        }
      })
      results.nupcoUser = nupcoUser || 'not found'
    } catch (e: any) {
      results.nupcoUser = { error: e.message }
    }

    // 5. التحقق من المخزون
    try {
      const inventoryCount = await db.inventoryItem.count()
      const inventorySample = await db.inventoryItem.findMany({
        where: { genericItemNumber: { not: null } },
        take: 5,
        select: { genericItemNumber: true, genericItemDescription: true, totalQty: true, system: true }
      })
      results.inventory = { count: inventoryCount, sampleWithGenericNumber: inventorySample }
    } catch (e: any) {
      results.inventory = { error: e.message }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
