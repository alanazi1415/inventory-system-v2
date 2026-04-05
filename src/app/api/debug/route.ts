import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // اختبار الاتصال بقاعدة البيانات
    const userCount = await db.user.count()
    
    // التحقق من وجود جدول UserSession
    const sessionCount = await db.userSession.count()
    
    // محاولة إنشاء مستخدم تجريبي (بدون حفظ)
    const testUser = {
      username: 'test_' + Date.now(),
      password: 'test123',
      name: 'مستخدم تجريبي',
      isActive: true,
      canViewInventory: true,
      canViewAlerts: true,
      canViewExpiring: true,
      canViewExpired: true,
      canViewLifeSaving: true,
      canViewVaccines: true,
      canViewStrategic: true,
      canViewSmoking: true,
      canViewKidney: true,
      canViewCentral: true,
      canViewReports: true,
      canViewHoz: true,
      canViewMwsal: true,
    }
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      userCount,
      sessionCount,
      testUserData: testUser,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 })
  }
}
