import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Endpoint اختباري لإنشاء مستخدم - بدون تحقق من الأدمن
export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    console.log('Test create user - received data:', { ...data, password: '***' })
    
    // التحقق من البيانات المطلوبة
    if (!data.username || !data.name || !data.password) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }
    
    // التحقق من عدم وجود المستخدم
    const existingUser = await db.user.findUnique({
      where: { username: data.username }
    })
    
    if (existingUser) {
      return NextResponse.json({ error: 'اسم المستخدم موجود مسبقاً' }, { status: 400 })
    }
    
    console.log('Creating user in database...')
    
    const user = await db.user.create({
      data: {
        username: data.username,
        password: data.password,
        name: data.name,
        isActive: data.isActive ?? true,
        canViewInventory: data.canViewInventory ?? true,
        canViewAlerts: data.canViewAlerts ?? true,
        canViewExpiring: data.canViewExpiring ?? true,
        canViewExpired: data.canViewExpired ?? true,
        canViewLifeSaving: data.canViewLifeSaving ?? true,
        canViewVaccines: data.canViewVaccines ?? true,
        canViewStrategic: data.canViewStrategic ?? true,
        canViewSmoking: data.canViewSmoking ?? true,
        canViewKidney: data.canViewKidney ?? true,
        canViewCentral: data.canViewCentral ?? true,
        canViewReports: data.canViewReports ?? true,
        canViewHoz: data.canViewHoz ?? true,
        canViewMwsal: data.canViewMwsal ?? true
      }
    })
    
    console.log('User created successfully:', user.id)
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    })
  } catch (error: any) {
    console.error('Test create user error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في إنشاء المستخدم',
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET لاختبار الاتصال
export async function GET() {
  try {
    // اختبار إنشاء مستخدم مباشرة
    const testUsername = 'test_' + Date.now()
    
    const user = await db.user.create({
      data: {
        username: testUsername,
        password: 'test123',
        name: 'مستخدم اختباري',
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
        canViewMwsal: true
      }
    })
    
    // حذف المستخدم الاختباري
    await db.user.delete({ where: { id: user.id } })
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم إنشاء وحذف مستخدم اختباري بنجاح',
      testUserId: user.id
    })
  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json({ 
      error: 'فشل الاختبار',
      message: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 })
  }
}
