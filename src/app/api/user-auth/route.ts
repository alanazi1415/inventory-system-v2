import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyPassword, isPasswordHashed } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// تسجيل دخول المستخدم
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: 'يرجى إدخال كلمة المرور' }, { status: 400 })
    }
    
    // الحد من طول كلمة المرور لمنع الهجمات
    if (password.length > 100) {
      return NextResponse.json({ error: 'كلمة المرور طويلة جداً' }, { status: 400 })
    }
    
    // البحث عن مستخدم نشط
    const users = await db.user.findMany({
      where: { isActive: true }
    })
    
    // التحقق من كلمة المرور (مع دعم التشفير الجديد والقديم)
    let matchedUser = null
    
    for (const user of users) {
      if (isPasswordHashed(user.password)) {
        // كلمة المرور مشفرة - استخدام bcrypt
        const isValid = await verifyPassword(password, user.password)
        if (isValid) {
          matchedUser = user
          break
        }
      } else {
        // كلمة المرور غير مشفرة - مقارنة مباشرة (للتوافق مع البيانات القديمة)
        if (user.password === password) {
          matchedUser = user
          break
        }
      }
    }
    
    if (matchedUser) {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ساعة
      
      await db.userSession.create({
        data: { token, userId: matchedUser.id, expiresAt }
      })
      
      const cookieStore = await cookies()
      cookieStore.set('user_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt
      })
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: matchedUser.id,
          name: matchedUser.name,
          username: matchedUser.username,
          permissions: {
            canViewInventory: matchedUser.canViewInventory,
            canViewAlerts: matchedUser.canViewAlerts,
            canViewExpiring: matchedUser.canViewExpiring,
            canViewExpired: matchedUser.canViewExpired,
            canViewLifeSaving: matchedUser.canViewLifeSaving,
            canViewVaccines: matchedUser.canViewVaccines,
            canViewStrategic: matchedUser.canViewStrategic,
            canViewSmoking: matchedUser.canViewSmoking,
            canViewKidney: matchedUser.canViewKidney,
            canViewCentral: matchedUser.canViewCentral,
            canViewAlternatives: matchedUser.canViewAlternatives,
            canViewDelivery: matchedUser.canViewDelivery,
            canViewReports: matchedUser.canViewReports,
            canViewMovement: matchedUser.canViewMovement,
            canViewHoz: matchedUser.canViewHoz,
            canViewMwsal: matchedUser.canViewMwsal,
            canEditMovementSettings: matchedUser.canEditMovementSettings,
            canClassifyMovement: matchedUser.canClassifyMovement
          }
        }
      })
    }
    
    return NextResponse.json({ error: 'كلمة المرور غير صحيحة أو الحساب غير مفعل' }, { status: 401 })
  } catch (error: any) {
    console.error('User auth error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
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
              canViewAlternatives: userSession.user.canViewAlternatives,
              canViewDelivery: userSession.user.canViewDelivery,
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
