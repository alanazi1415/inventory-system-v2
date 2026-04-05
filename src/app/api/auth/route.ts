import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    // الحصول على كلمة المرور - نتحقق من قاعدة البيانات أولاً
    let adminPassword = process.env.ADMIN_PASSWORD || '123258'
    
    try {
      const savedPassword = await db.$queryRaw<{ password: string }[]>`
        SELECT password FROM "AdminPassword" WHERE id = 'admin-password' LIMIT 1
      `
      if (savedPassword && savedPassword.length > 0) {
        adminPassword = savedPassword[0].password
      }
    } catch (e) {
      // جدول AdminPassword غير موجود بعد، نستخدم متغير البيئة
      console.log('Using env password')
    }
    
    if (username === 'admin' && password === adminPassword) {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      
      try {
        await db.adminSession.create({
          data: { token, expiresAt }
        })
      } catch (dbError) {
        console.log('DB Error (might be first time):', dbError)
        // Continue anyway - cookie will still work
      }
      
      const cookieStore = await cookies()
      cookieStore.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt
      })
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 })
  } catch (error: any) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      try {
        await db.adminSession.deleteMany({
          where: { token: session.value }
        })
      } catch (dbError) {
        console.log('DB Error:', dbError)
      }
    }
    
    cookieStore.delete('admin_session')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return NextResponse.json({ authenticated: true })
      }
    }
    
    return NextResponse.json({ authenticated: false })
  } catch (error) {
    return NextResponse.json({ authenticated: false })
  }
}
