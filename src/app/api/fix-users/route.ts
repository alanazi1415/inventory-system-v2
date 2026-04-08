import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // جلب جميع المستخدمين
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        isActive: true,
        createdAt: true
      }
    })

    // التحقق من جلسات المستخدمين
    const sessions = await db.userSession.findMany()

    return NextResponse.json({
      usersCount: users.length,
      users: users,
      sessionsCount: sessions.length
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

// إعادة تعيين كلمة مرور مستخدم
export async function POST(request: Request) {
  try {
    const { username, newPassword } = await request.json()

    const user = await db.user.update({
      where: { username },
      data: { password: newPassword, isActive: true }
    })

    return NextResponse.json({
      success: true,
      message: `تم تحديث كلمة مرور المستخدم: ${user.name}`,
      user: { id: user.id, username: user.username, name: user.name }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
