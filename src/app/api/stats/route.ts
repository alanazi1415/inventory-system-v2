import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'hoz'

    console.log('Stats API called for system:', system)

    // التحقق من الأعمدة الجديدة وإضافتها إذا لم تكن موجودة
    try {
      await db.$executeRaw`SELECT "isSmoking", "isKidney", "isCentral" FROM "InventoryItem" LIMIT 1`
    } catch {
      console.log('Adding new columns...')
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSmoking" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isKidney" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isCentral" BOOLEAN NOT NULL DEFAULT false`
    }

    // Basic counts - بدون البنود المنتهية (daysToExpire > 0)
    const [
      totalItems,
      expiredItems,
      holdItems,
      lifeSavingItems,
      narcoticItems,
      vaccineItems,
      strategicItems,
      smokingItems,
      kidneyItems,
      centralItems
    ] = await Promise.all([
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 } } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { lte: 0 } } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, holdQty: { gt: 0 } } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isLifeSaving: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isNarcotic: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isVaccine: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isStrategic: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isSmoking: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isKidney: true } }),
      db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0 }, isCentral: true } }),
    ])

    // Aggregated quantities - بدون البنود المنتهية
    const totalQty = await db.inventoryItem.aggregate({
      where: { system, daysToExpire: { gt: 0 } },
      _sum: { totalQty: true, availableQty: true, holdQty: true }
    })

    // Hold Types distribution - بدون البنود المنتهية
    const holdTypes = await db.inventoryItem.groupBy({
      by: ['holdType'],
      where: { system, daysToExpire: { gt: 0 }, holdQty: { gt: 0 } },
      _count: { id: true },
      _sum: { holdQty: true }
    })

    // Expiry distribution - فقط البنود غير المنتهية
    const expiryDistribution = {
      oneMonth: await db.inventoryItem.count({ where: { system, daysToExpire: { gt: 0, lte: 30 } } }),
      threeMonths: await db.inventoryItem.count({ where: { system, daysToExpire: { gt: 30, lte: 90 } } }),
      sixMonths: await db.inventoryItem.count({ where: { system, daysToExpire: { gt: 90, lte: 180 } } }),
      oneYear: await db.inventoryItem.count({ where: { system, daysToExpire: { gt: 180, lte: 365 } } }),
      overYear: await db.inventoryItem.count({ where: { system, daysToExpire: { gt: 365 } } }),
    }

    // البنود قاربت على الانتهاء (أقل من 90 يوم)
    const expiringItems = await db.inventoryItem.count({ 
      where: { system, daysToExpire: { gt: 0, lte: 90 } } 
    })

    // عدد مجموعات البدائل الدوائية
    let alternativesCount = 0
    try {
      const altCount = await db.$queryRaw`SELECT COUNT(*) as count FROM "AlternativeGroup" WHERE "isActive" = true` as any[]
      alternativesCount = parseInt(altCount[0]?.count || '0')
    } catch (e) {
      console.log('Could not count alternatives:', e)
    }

    // عدد المراكز الصحية في جدول التوصيل
    let deliveryCentersCount = 0
    let deliveryNeedApprovalCount = 0
    try {
      deliveryCentersCount = await db.deliveryCenter.count({ where: { isActive: true } })
      
      // حساب المراكز التي تحتاج موافقة (24-48 ساعة) مع مراعاة عطلة نهاية الأسبوع
      const allCenters = await db.deliveryCenter.findMany({ where: { isActive: true } })
      
      // دالة حساب الأيام المتبقية (نسخة مبسطة من delivery-schedule API)
      const FRIDAY = 5
      const SATURDAY = 6
      
      // دالة للحصول على التاريخ بتوقيت السعودية
      const getSaudiDate = (): { today: Date; currentDay: number; currentMonth: number; currentYear: number } => {
        const now = new Date()
        const saudiOffset = 3 * 60
        const utcOffset = now.getTimezoneOffset()
        const saudiTime = new Date(now.getTime() + (utcOffset + saudiOffset) * 60 * 1000)
        return {
          today: new Date(saudiTime.getFullYear(), saudiTime.getMonth(), saudiTime.getDate()),
          currentDay: saudiTime.getDate(),
          currentMonth: saudiTime.getMonth(),
          currentYear: saudiTime.getFullYear()
        }
      }
      
      const getEffectiveDeliveryDate = (deliveryDay: number, currentMonth: number, currentYear: number): Date => {
        let deliveryDate = new Date(currentYear, currentMonth, deliveryDay)
        let dayOfWeek = deliveryDate.getDay()
        
        if (dayOfWeek === FRIDAY) {
          deliveryDate = new Date(currentYear, currentMonth, deliveryDay - 1)
        } else if (dayOfWeek === SATURDAY) {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          if (deliveryDay + 1 <= daysInMonth) {
            deliveryDate = new Date(currentYear, currentMonth, deliveryDay + 1)
          } else {
            deliveryDate = new Date(currentYear, currentMonth + 1, 1)
          }
        }
        return deliveryDate
      }
      
      const getDaysUntilDelivery = (deliveryDay: number): number => {
        const { today, currentMonth, currentYear } = getSaudiDate()
        
        let effectiveDate = getEffectiveDeliveryDate(deliveryDay, currentMonth, currentYear)
        
        if (effectiveDate < today) {
          let nextMonth = currentMonth + 1
          let nextYear = currentYear
          if (nextMonth > 11) {
            nextMonth = 0
            nextYear++
          }
          effectiveDate = getEffectiveDeliveryDate(deliveryDay, nextMonth, nextYear)
        }
        
        const diffTime = effectiveDate.getTime() - today.getTime()
        return Math.round(diffTime / (1000 * 60 * 60 * 24))
      }
      
      // عد المراكز التي بقي على موعدها 1-2 يوم (24-48 ساعة)
      deliveryNeedApprovalCount = allCenters.filter(c => {
        const days = getDaysUntilDelivery(c.deliveryDay)
        return days === 1 || days === 2
      }).length
    } catch (e) {
      console.log('Could not count delivery centers:', e)
    }

    return NextResponse.json({
      totalItems,
      expiredItems,
      expiringItems,
      holdItems,
      lifeSavingItems,
      narcoticItems,
      vaccineItems,
      strategicItems,
      smokingItems,
      kidneyItems,
      centralItems,
      alternativesCount,
      deliveryCentersCount,
      deliveryNeedApprovalCount,
      totalQty: totalQty._sum.totalQty || 0,
      availableQty: totalQty._sum.availableQty || 0,
      holdQtySum: totalQty._sum.holdQty || 0,
      holdTypes: holdTypes.map(h => ({
        type: h.holdType || 'غير محدد',
        count: h._count.id,
        qty: h._sum.holdQty || 0
      })),
      expiryDistribution
    })
  } catch (error: any) {
    console.error('Stats error:', error)
    return NextResponse.json({
      totalItems: 0,
      expiredItems: 0,
      expiringItems: 0,
      holdItems: 0,
      lifeSavingItems: 0,
      narcoticItems: 0,
      vaccineItems: 0,
      strategicItems: 0,
      smokingItems: 0,
      kidneyItems: 0,
      centralItems: 0,
      alternativesCount: 0,
      deliveryCentersCount: 0,
      deliveryNeedApprovalCount: 0,
      totalQty: 0,
      availableQty: 0,
      holdQtySum: 0,
      holdTypes: [],
      expiryDistribution: { oneMonth: 0, threeMonths: 0, sixMonths: 0, oneYear: 0, overYear: 0 }
    })
  }
}
