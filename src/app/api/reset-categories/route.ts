import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // إعادة تعيين جميع التصنيفات إلى false
    await db.inventoryItem.updateMany({
      data: {
        isLifeSaving: false,
        isNarcotic: false,
        isVaccine: false,
        isStrategic: false,
        isSmoking: false,
        isKidney: false,
        isCentral: false
      }
    })

    // حذف جميع جداول التصنيفات
    await db.lifeSavingItem.deleteMany().catch(() => {})
    await db.narcoticItem.deleteMany().catch(() => {})
    await db.vaccineItem.deleteMany().catch(() => {})
    await db.strategicItem.deleteMany().catch(() => {})
    await db.$executeRaw`DELETE FROM "SmokingItem"`.catch(() => {})
    await db.$executeRaw`DELETE FROM "KidneyItem"`.catch(() => {})
    await db.$executeRaw`DELETE FROM "CentralItem"`.catch(() => {})

    return NextResponse.json({
      status: 'success',
      message: 'تم إعادة تعيين جميع التصنيفات. الآن يمكنك إعادة رفع ملفات التصنيفات بالترتيب.'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}
