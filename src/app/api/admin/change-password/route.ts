import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  
  if (session?.value) {
    const adminSession = await db.adminSession.findUnique({
      where: { token: session.value }
    })
    
    if (adminSession && adminSession.expiresAt > new Date()) {
      return true
    }
  }
  
  return false
}

// تغيير كلمة مرور الأدمن
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const { currentPassword, newPassword } = await request.json()
    
    // الحصول على كلمة المرور الحالية (من قاعدة البيانات أو من متغير البيئة)
    let adminPassword = process.env.ADMIN_PASSWORD || '123258'
    
    // التحقق من وجود كلمة مرور محفوظة في قاعدة البيانات
    try {
      const savedPassword = await db.$queryRaw<{ password: string }[]>`
        SELECT password FROM "AdminPassword" WHERE id = 'admin-password' LIMIT 1
      `
      if (savedPassword && savedPassword.length > 0) {
        adminPassword = savedPassword[0].password
      }
    } catch (e) {
      // جدول AdminPassword غير موجود بعد، نستخدم متغير البيئة
    }
    
    if (currentPassword !== adminPassword) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 })
    }
    
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' }, { status: 400 })
    }
    
    // حفظ كلمة المرور الجديدة في قاعدة البيانات
    await db.$executeRaw`
      INSERT INTO "AdminPassword" (id, password, "createdAt", "updatedAt")
      VALUES ('admin-password', ${newPassword}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET password = ${newPassword}, "updatedAt" = NOW()
    `
    
    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (error: any) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}
