import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // التحقق من الأعمدة الجديدة
    try {
      await db.$executeRaw`SELECT "isSmoking", "isKidney", "isCentral" FROM "InventoryItem" LIMIT 1`
    } catch {
      console.log('Adding new columns...')
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isSmoking" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isKidney" BOOLEAN NOT NULL DEFAULT false`
      await db.$executeRaw`ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isCentral" BOOLEAN NOT NULL DEFAULT false`
    }

    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'hoz'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || 'all'
    const sortBy = searchParams.get('sortBy') || 'daysToExpire'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    const skip = (page - 1) * limit
    const where: Prisma.InventoryItemWhereInput = { system }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { genericItemNumber: { contains: search, mode: 'insensitive' } },
        { genericItemDescription: { contains: search, mode: 'insensitive' } },
        { tradeItemNumber: { contains: search, mode: 'insensitive' } },
        { customerItemNumber: { contains: search, mode: 'insensitive' } },
        { holdType: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Category filters
    switch (category) {
      case 'all':
        // استبعاد البنود المنتهية من العرض الافتراضي
        where.daysToExpire = { gt: 0 }
        break
      case 'expired':
        where.daysToExpire = { lte: 0 }
        break
      case 'expiring':
        where.daysToExpire = { gt: 0, lte: 90 }
        break
      case 'hold':
        where.holdQty = { gt: 0 }
        break
      case 'life_saving':
        where.isLifeSaving = true
        where.daysToExpire = { gt: 0 }
        break
      case 'narcotic':
        where.isNarcotic = true
        where.daysToExpire = { gt: 0 }
        break
      case 'vaccine':
        where.isVaccine = true
        where.daysToExpire = { gt: 0 }
        break
      case 'strategic':
        where.isStrategic = true
        where.daysToExpire = { gt: 0 }
        break
      case 'smoking':
        where.isSmoking = true
        where.daysToExpire = { gt: 0 }
        break
      case 'kidney':
        where.isKidney = true
        where.daysToExpire = { gt: 0 }
        break
      case 'central':
        where.isCentral = true
        where.daysToExpire = { gt: 0 }
        break
    }

    // Sorting
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({ where, orderBy, skip, take: limit }),
      db.inventoryItem.count({ where })
    ])

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error: any) {
    console.error('Inventory error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}
