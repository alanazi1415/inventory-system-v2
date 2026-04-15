import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Admin stats API called')
    
    // Basic counts
    const totalVisits = await db.visitorLog.count().catch(() => 0)

    // حساب زيارات اليوم
    const now = new Date()
    const saudiOffset = 3 * 60 * 60 * 1000
    const saudiNow = new Date(now.getTime() + saudiOffset)
    const saudiStartOfDay = new Date(saudiNow)
    saudiStartOfDay.setUTCHours(0, 0, 0, 0)
    const todayStartUTC = new Date(saudiStartOfDay.getTime() - saudiOffset)

    let todayVisits = totalVisits
    try {
      todayVisits = await db.$queryRaw`
        SELECT COUNT(*)::int as count FROM "VisitorLog" WHERE "visitedAt" >= ${todayStartUTC}
      `.then((r: any) => r[0]?.count || 0)
    } catch (e) {
      console.log('visitedAt query failed, using total visits')
    }
    
    // Inventory counts - بدون البنود المنتهية
    const hozItems = await db.inventoryItem.count({ where: { system: 'hoz', daysToExpire: { gt: 0 } } }).catch(() => 0)
    const mwsalItems = await db.inventoryItem.count({ where: { system: 'mwsal', daysToExpire: { gt: 0 } } }).catch(() => 0)
    
    // Hold items
    const hozHoldItems = await db.inventoryItem.count({ where: { system: 'hoz', daysToExpire: { gt: 0 }, holdQty: { gt: 0 } } }).catch(() => 0)
    const mwsalHoldItems = await db.inventoryItem.count({ where: { system: 'mwsal', daysToExpire: { gt: 0 }, holdQty: { gt: 0 } } }).catch(() => 0)
    
    // Hold Types
    const hozHoldTypes = await db.inventoryItem.groupBy({
      by: ['holdType'],
      where: { system: 'hoz', daysToExpire: { gt: 0 }, holdQty: { gt: 0 } },
      _count: { id: true },
      _sum: { holdQty: true }
    }).catch(() => [])

    const mwsalHoldTypes = await db.inventoryItem.groupBy({
      by: ['holdType'],
      where: { system: 'mwsal', daysToExpire: { gt: 0 }, holdQty: { gt: 0 } },
      _count: { id: true },
      _sum: { holdQty: true }
    }).catch(() => [])
    
    // Special items counts from lists
    const lifeSavingCount = await db.lifeSavingItem.count().catch(() => 0)
    const narcoticCount = await db.narcoticItem.count().catch(() => 0)
    const vaccineCount = await db.vaccineItem.count().catch(() => 0)
    const strategicCount = await db.strategicItem.count().catch(() => 0)
    
    // New categories counts
    let smokingCount = 0
    let kidneyCount = 0
    let centralCount = 0
    let alternativesCount = 0
    let deliveryCentersCount = 0
    try {
      const smokingResult = await db.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "SmokingItem"`
      smokingCount = smokingResult[0]?.count || 0
    } catch {}
    try {
      const kidneyResult = await db.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "KidneyItem"`
      kidneyCount = kidneyResult[0]?.count || 0
    } catch {}
    try {
      const centralResult = await db.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "CentralItem"`
      centralCount = centralResult[0]?.count || 0
    } catch {}
    try {
      const alternativesResult = await db.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "AlternativeGroup"`
      alternativesCount = alternativesResult[0]?.count || 0
    } catch {}
    try {
      const deliveryResult = await db.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "DeliveryCenter"`
      deliveryCentersCount = deliveryResult[0]?.count || 0
    } catch {}
    
    // Items marked as special in inventory
    const lifeSavingInHoz = await db.inventoryItem.count({ where: { system: 'hoz', daysToExpire: { gt: 0 }, isLifeSaving: true } }).catch(() => 0)
    const lifeSavingInMwsal = await db.inventoryItem.count({ where: { system: 'mwsal', daysToExpire: { gt: 0 }, isLifeSaving: true } }).catch(() => 0)
    
    // Expiry stats - فقط غير المنتهية
    const hozExpiring = await db.inventoryItem.count({ where: { system: 'hoz', daysToExpire: { gt: 0, lte: 90 } } }).catch(() => 0)
    const mwsalExpiring = await db.inventoryItem.count({ where: { system: 'mwsal', daysToExpire: { gt: 0, lte: 90 } } }).catch(() => 0)

    // Last upload
    const lastUpload = await db.uploadLog.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null)

    const result = {
      totalVisits,
      todayVisits,
      hozItems,
      mwsalItems,
      hozHoldItems,
      mwsalHoldItems,
      hozHoldTypes: hozHoldTypes.map(h => ({
        type: h.holdType || 'غير محدد',
        count: h._count.id,
        qty: h._sum.holdQty || 0
      })),
      mwsalHoldTypes: mwsalHoldTypes.map(h => ({
        type: h.holdType || 'غير محدد',
        count: h._count.id,
        qty: h._sum.holdQty || 0
      })),
      lifeSavingCount,
      narcoticCount,
      vaccineCount,
      strategicCount,
      smokingCount,
      kidneyCount,
      centralCount,
      alternativesCount,
      deliveryCentersCount,
      lifeSavingInHoz,
      lifeSavingInMwsal,
      hozExpiring,
      mwsalExpiring,
      lastUpload: lastUpload ? {
        fileName: lastUpload.fileName,
        system: lastUpload.system,
        records: lastUpload.recordsCount,
        time: lastUpload.createdAt
      } : null
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json({
      totalVisits: 0,
      todayVisits: 0,
      hozItems: 0,
      mwsalItems: 0,
      hozHoldItems: 0,
      mwsalHoldItems: 0,
      hozHoldTypes: [],
      mwsalHoldTypes: [],
      lifeSavingCount: 0,
      narcoticCount: 0,
      vaccineCount: 0,
      strategicCount: 0,
      smokingCount: 0,
      kidneyCount: 0,
      centralCount: 0,
      alternativesCount: 0,
      deliveryCentersCount: 0,
      lifeSavingInHoz: 0,
      lifeSavingInMwsal: 0,
      hozExpiring: 0,
      mwsalExpiring: 0,
      lastUpload: null
    })
  }
}
