import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    console.log('Checking admin auth, cookie exists:', !!session?.value)
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      console.log('Admin session in DB:', !!adminSession)
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return true
      }
      
      // إذا لم يتم العثور على الجلسة في DB، نتحقق من صحة الـ token
      // ونعيد إنشاؤه إذا لزم الأمر
      if (!adminSession) {
        console.log('Session not in DB, but cookie exists - recreating...')
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        try {
          await db.adminSession.create({
            data: { token: session.value, expiresAt }
          })
          return true
        } catch (e) {
          console.log('Failed to recreate session:', e)
        }
      }
    }
    
    return false
  } catch (error) {
    console.error('Admin auth check error:', error)
    return false
  }
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
        canViewExpired: true,
        canViewLifeSaving: true,
        canViewVaccines: true,
        canViewStrategic: true,
        canViewSmoking: true,
        canViewKidney: true,
        canViewCentral: true,
        canViewReports: true,
        canViewMovement: true,
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
    console.log('POST /api/users - Starting...')
    
    const isAdmin = await checkAdminAuth()
    console.log('Admin auth check result:', isAdmin)
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    
    const data = await request.json()
    console.log('Received data:', { ...data, password: '***' })
    
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
    
    console.log('Creating user...')
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
        canViewMovement: data.canViewMovement ?? true,
        canViewHoz: data.canViewHoz ?? true,
        canViewMwsal: data.canViewMwsal ?? true
      }
    })
    
    console.log('User created successfully:', user.id)
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Create user error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ 
      error: 'حدث خطأ في إنشاء المستخدم', 
      details: error.message,
      code: error.code 
    }, { status: 500 })
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
      canViewExpired: data.canViewExpired,
      canViewLifeSaving: data.canViewLifeSaving,
      canViewVaccines: data.canViewVaccines,
      canViewStrategic: data.canViewStrategic,
      canViewSmoking: data.canViewSmoking,
      canViewKidney: data.canViewKidney,
      canViewCentral: data.canViewCentral,
      canViewReports: data.canViewReports,
      canViewMovement: data.canViewMovement,
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
