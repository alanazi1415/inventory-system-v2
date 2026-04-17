import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// التحقق من صلاحية الأدمن
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      if (adminSession && adminSession.expiresAt > new Date()) {
        return true
      }
      
      // إذا لم يتم العثور على الجلسة في DB، نعيد إنشاؤها
      if (!adminSession) {
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
        canViewAlternatives: true,
        canViewDelivery: true,
        canViewHoz: true,
        canViewMwsal: true,
        canEditMovementSettings: true,
        canClassifyMovement: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
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
    
    // التحقق من البيانات المطلوبة
    if (!data.username || !data.name || !data.password) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }
    
    // التحقق من طول كلمة المرور
    if (data.password.length < 4) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }, { status: 400 })
    }
    
    // التحقق من عدم وجود المستخدم
    const existingUser = await db.user.findUnique({
      where: { username: data.username }
    })
    
    if (existingUser) {
      return NextResponse.json({ error: 'اسم المستخدم موجود مسبقاً' }, { status: 400 })
    }
    
    // تشفير كلمة المرور
    const hashedPassword = await hashPassword(data.password)
    
    const user = await db.user.create({
      data: {
        username: data.username.trim(),
        password: hashedPassword,
        name: data.name.trim(),
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
        canViewAlternatives: data.canViewAlternatives ?? true,
        canViewDelivery: data.canViewDelivery ?? true,
        canViewHoz: data.canViewHoz ?? true,
        canViewMwsal: data.canViewMwsal ?? true,
        canEditMovementSettings: data.canEditMovementSettings ?? false,
        canClassifyMovement: data.canClassifyMovement ?? false
      }
    })
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'حدث خطأ في إنشاء المستخدم' }, { status: 500 })
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
    
    if (!data.id) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
    }
    
    const updateData: any = {
      name: data.name?.trim(),
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
      canViewAlternatives: data.canViewAlternatives,
      canViewDelivery: data.canViewDelivery,
      canViewHoz: data.canViewHoz,
      canViewMwsal: data.canViewMwsal,
      canEditMovementSettings: data.canEditMovementSettings,
      canClassifyMovement: data.canClassifyMovement
    }
    
    // تحديث كلمة المرور فقط إذا تم توفيرها (مع التشفير)
    if (data.password && data.password.length >= 4) {
      updateData.password = await hashPassword(data.password)
    }
    
    const user = await db.user.update({
      where: { id: data.id },
      data: updateData
    })
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
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
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
