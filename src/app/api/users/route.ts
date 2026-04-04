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

// جلب جميع المستخدمين
export async function GET() {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        canViewInventory: true,
        canViewAlerts: true,
        canViewExpiring: true,
        canViewLifeSaving: true,
        canViewVaccines: true,
        canViewStrategic: true,
        canViewSmoking: true,
        canViewKidney: true,
        canViewCentral: true,
        canViewReports: true,
        canViewHoz: true,
        canViewMwsal: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

// إنشاء مستخدم جديد
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const data = await request.json()
    
    // التحقق من عدم وجود المستخدم
    const existingUser = await db.user.findUnique({
      where: { username: data.username }
    })
    
    if (existingUser) {
      return NextResponse.json({ error: 'اسم المستخدم موجود مسبقاً' }, { status: 400 })
    }
    
    const user = await db.user.create({
      data: {
        username: data.username,
        password: data.password,
        name: data.name,
        isActive: data.isActive ?? true,
        canViewInventory: data.canViewInventory ?? true,
        canViewAlerts: data.canViewAlerts ?? true,
        canViewExpiring: data.canViewExpiring ?? true,
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
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

// تحديث مستخدم
export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const data = await request.json()
    
    const updateData: any = {
      name: data.name,
      isActive: data.isActive,
      canViewInventory: data.canViewInventory,
      canViewAlerts: data.canViewAlerts,
      canViewExpiring: data.canViewExpiring,
      canViewLifeSaving: data.canViewLifeSaving,
      canViewVaccines: data.canViewVaccines,
      canViewStrategic: data.canViewStrategic,
      canViewSmoking: data.canViewSmoking,
      canViewKidney: data.canViewKidney,
      canViewCentral: data.canViewCentral,
      canViewReports: data.canViewReports,
      canViewHoz: data.canViewHoz,
      canViewMwsal: data.canViewMwsal
    }
    
    // تحديث كلمة المرور فقط إذا تم توفيرها
    if (data.password) {
      updateData.password = data.password
    }
    
    const user = await db.user.update({
      where: { id: data.id },
      data: updateData
    })
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}

// حذف مستخدم
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
    }
    
    await db.user.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'حدث خطأ', details: error.message }, { status: 500 })
  }
}
