import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      return !!(adminSession && adminSession.expiresAt > new Date())
    }
    return false
  } catch {
    return false
  }
}

export async function GET() {
  try {
    // التحقق من صلاحية الأدمن
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({
        status: 'error',
        message: 'غير مصرح - يجب تسجيل الدخول كأدمن أولاً'
      }, { status: 401 })
    }

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
      message: 'تم إعادة تعيين جميع التصنيفات. الآن يمكنك إعادة رفع ملفات التصنيفات.'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}
