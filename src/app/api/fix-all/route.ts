import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. تحديث جميع المستخدمين بالقيم الافتراضية للأعمدة الجديدة
    await db.$executeRawUnsafe(`
      UPDATE "User"
      SET "canEditMovementSettings" = COALESCE("canEditMovementSettings", false),
          "canViewTopUp" = COALESCE("canViewTopUp", true),
          "canCalculateTopUp" = COALESCE("canCalculateTopUp", false)
      WHERE "canEditMovementSettings" IS NULL
         OR "canViewTopUp" IS NULL
         OR "canCalculateTopUp" IS NULL
    `)

    // 2. حذف جميع الجلسات القديمة
    await db.userSession.deleteMany({})

    // 3. جلب المستخدمين بعد التحديث
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        isActive: true,
        canEditMovementSettings: true,
        canViewTopUp: true,
        canCalculateTopUp: true
      }
    })

    return NextResponse.json({
      status: 'success',
      message: 'تم تحديث جميع المستخدمين وحذف الجلسات القديمة',
      usersCount: users.length,
      users: users
    })
  } catch (error: any) {
    console.error('Fix all error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code
    }, { status: 500 })
  }
}
