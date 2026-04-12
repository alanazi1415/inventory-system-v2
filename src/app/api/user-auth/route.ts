import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// تسجيل دخول المستخدم
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: 'يرجى إدخال كلمة المرور' }, { status: 400 })
    }
    
    // البحث عن مستخدم بكلمة المرور
    const user = await db.user.findFirst({
      where: {
        password: password,
        isActive: true
      }
    })
    
    if (user) {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ساعة
      
      await db.userSession.create({
        data: { token, userId: user.id, expiresAt }
      })
      
      const cookieStore = await cookies()
      cookieStore.set('user_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        expires: expiresAt
      })
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          permissions: {
            canViewInventory: user.canViewInventory,
            canViewAlerts: user.canViewAlerts,
            canViewExpiring: user.canViewExpiring,
            canViewExpired: user.canViewExpired,
            canViewLifeSaving: user.canViewLifeSaving,
            canViewVaccines: user.canViewVaccines,
            canViewStrategic: user.canViewStrategic,
            canViewSmoking: user.canViewSmoking,
            canViewKidney: user.canViewKidney,
            canViewCentral: user.canViewCentral,
            canViewReports: user.canViewReports,
            canViewMovement: user.canViewMovement,
            canViewHoz: user.canViewHoz,
            canViewMwsal: user.canViewMwsal,
            canEditMovementSettings: user.canEditMovementSettings,
            canClassifyMovement: user.canClassifyMovement
          }
        }
      })
    }
    
    return NextResponse.json({ error: 'كلمة المرور غير صحيحة أو الحساب غير مفعل' }, { status: 401 })
  } catch (error: any) {
    console.error('User auth error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

// التحقق من الجلسة
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('user_session')
    
    if (session?.value) {
      const userSession = await db.userSession.findUnique({
        where: { token: session.value },
        include: { user: true }
      })
      
      if (userSession && userSession.expiresAt > new Date() && userSession.user.isActive) {
        return NextResponse.json({
          authenticated: true,
          user: {
            id: userSession.user.id,
            name: userSession.user.name,
            username: userSession.user.username,
            permissions: {
              canViewInventory: userSession.user.canViewInventory,
              canViewAlerts: userSession.user.canViewAlerts,
              canViewExpiring: userSession.user.canViewExpiring,
              canViewExpired: userSession.user.canViewExpired,
              canViewLifeSaving: userSession.user.canViewLifeSaving,
              canViewVaccines: userSession.user.canViewVaccines,
              canViewStrategic: userSession.user.canViewStrategic,
              canViewSmoking: userSession.user.canViewSmoking,
              canViewKidney: userSession.user.canViewKidney,
              canViewCentral: userSession.user.canViewCentral,
              canViewReports: userSession.user.canViewReports,
              canViewMovement: userSession.user.canViewMovement,
              canViewHoz: userSession.user.canViewHoz,
              canViewMwsal: userSession.user.canViewMwsal,
              canEditMovementSettings: userSession.user.canEditMovementSettings,
              canClassifyMovement: userSession.user.canClassifyMovement
            }
          }
        })
      }
    }
    
    return NextResponse.json({ authenticated: false })
  } catch (error) {
    return NextResponse.json({ authenticated: false })
  }
}

// تسجيل الخروج
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('user_session')
    
    if (session?.value) {
      try {
        await db.userSession.deleteMany({
          where: { token: session.value }
        })
      } catch (dbError) {
        console.log('DB Error:', dbError)
      }
    }
    
    cookieStore.delete('user_session')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
