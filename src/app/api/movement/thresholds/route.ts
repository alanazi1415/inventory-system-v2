import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

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
    }
    return false
  } catch (error) {
    console.error('Admin auth check error:', error)
    return false
  }
}

// التحقق من صلاحية المستخدم للعرض
async function checkMovementViewAccess(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    
    // تحقق من صلاحية الأدمن
    const adminSession = cookieStore.get('admin_session')
    if (adminSession?.value) {
      const session = await db.adminSession.findUnique({
        where: { token: adminSession.value }
      })
      if (session && session.expiresAt > new Date()) {
        return true
      }
    }
    
    // تحقق من صلاحية المستخدم
    const userSession = cookieStore.get('user_session')
    if (userSession?.value) {
      const session = await db.userSession.findUnique({
        where: { token: userSession.value },
        include: { user: true }
      })
      if (session && session.expiresAt > new Date() && session.user.isActive) {
        return !!session.user.canViewMovement
      }
    }
    
    return false
  } catch (error) {
    console.error('Movement view access check error:', error)
    return false
  }
}

// التحقق من صلاحية تعديل الإعدادات
async function checkSettingsEditAccess(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    
    // تحقق من صلاحية الأدمن
    const adminSession = cookieStore.get('admin_session')
    if (adminSession?.value) {
      const session = await db.adminSession.findUnique({
        where: { token: adminSession.value }
      })
      if (session && session.expiresAt > new Date()) {
        return true // الأدمن له كل الصلاحيات
      }
    }
    
    // تحقق من صلاحية المستخدم
    const userSession = cookieStore.get('user_session')
    if (userSession?.value) {
      const session = await db.userSession.findUnique({
        where: { token: userSession.value },
        include: { user: true }
      })
      if (session && session.expiresAt > new Date() && session.user.isActive) {
        return !!session.user.canEditMovementSettings
      }
    }
    
    return false
  } catch (error) {
    console.error('Settings edit access check error:', error)
    return false
  }
}

// القيم الافتراضية للحدود
const DEFAULT_THRESHOLDS = {
  veryFastMinTransactions: 50,
  veryFastMinQty: 5000,
  fastMinTransactions: 20,
  fastMinQty: 2000,
  mediumMinTransactions: 10,
  mediumMinQty: 500,
  slowMinTransactions: 3,
  topUpDaysToAnalyze: 90,
  topUpSafetyFactor: 1.5,
  topUpMinStockDays: 30
}

// جلب إعدادات الحدود (للعرض - أي مستخدم لديه صلاحية تحليل الحركة)
export async function GET(request: NextRequest) {
  try {
    const hasAccess = await checkMovementViewAccess()
    if (!hasAccess) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system') || 'mwsal'

    const thresholds = await db.movementThresholds.findUnique({
      where: { system }
    })

    if (!thresholds) {
      // إرجاع القيم الافتراضية
      return NextResponse.json({
        success: true,
        thresholds: {
          system,
          ...DEFAULT_THRESHOLDS,
          isDefault: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      thresholds: {
        ...thresholds,
        isDefault: false
      }
    })
  } catch (error: any) {
    console.error('Get thresholds error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في جلب الإعدادات',
      details: error.message 
    }, { status: 500 })
  }
}

// حفظ إعدادات الحدود
export async function POST(request: NextRequest) {
  try {
    const hasEditAccess = await checkSettingsEditAccess()
    if (!hasEditAccess) {
      return NextResponse.json({ error: 'غير مصرح - يجب أن يكون لديك صلاحية تعديل الإعدادات' }, { status: 401 })
    }

    const body = await request.json()
    const {
      system,
      veryFastMinTransactions,
      veryFastMinQty,
      fastMinTransactions,
      fastMinQty,
      mediumMinTransactions,
      mediumMinQty,
      slowMinTransactions,
      topUpDaysToAnalyze,
      topUpSafetyFactor,
      topUpMinStockDays
    } = body

    if (!system) {
      return NextResponse.json({ error: 'المستودع مطلوب' }, { status: 400 })
    }

    // حفظ أو تحديث الإعدادات
    const thresholds = await db.movementThresholds.upsert({
      where: { system },
      update: {
        veryFastMinTransactions: veryFastMinTransactions ?? DEFAULT_THRESHOLDS.veryFastMinTransactions,
        veryFastMinQty: veryFastMinQty ?? DEFAULT_THRESHOLDS.veryFastMinQty,
        fastMinTransactions: fastMinTransactions ?? DEFAULT_THRESHOLDS.fastMinTransactions,
        fastMinQty: fastMinQty ?? DEFAULT_THRESHOLDS.fastMinQty,
        mediumMinTransactions: mediumMinTransactions ?? DEFAULT_THRESHOLDS.mediumMinTransactions,
        mediumMinQty: mediumMinQty ?? DEFAULT_THRESHOLDS.mediumMinQty,
        slowMinTransactions: slowMinTransactions ?? DEFAULT_THRESHOLDS.slowMinTransactions,
        topUpDaysToAnalyze: topUpDaysToAnalyze ?? DEFAULT_THRESHOLDS.topUpDaysToAnalyze,
        topUpSafetyFactor: topUpSafetyFactor ?? DEFAULT_THRESHOLDS.topUpSafetyFactor,
        topUpMinStockDays: topUpMinStockDays ?? DEFAULT_THRESHOLDS.topUpMinStockDays
      },
      create: {
        system,
        veryFastMinTransactions: veryFastMinTransactions ?? DEFAULT_THRESHOLDS.veryFastMinTransactions,
        veryFastMinQty: veryFastMinQty ?? DEFAULT_THRESHOLDS.veryFastMinQty,
        fastMinTransactions: fastMinTransactions ?? DEFAULT_THRESHOLDS.fastMinTransactions,
        fastMinQty: fastMinQty ?? DEFAULT_THRESHOLDS.fastMinQty,
        mediumMinTransactions: mediumMinTransactions ?? DEFAULT_THRESHOLDS.mediumMinTransactions,
        mediumMinQty: mediumMinQty ?? DEFAULT_THRESHOLDS.mediumMinQty,
        slowMinTransactions: slowMinTransactions ?? DEFAULT_THRESHOLDS.slowMinTransactions,
        topUpDaysToAnalyze: topUpDaysToAnalyze ?? DEFAULT_THRESHOLDS.topUpDaysToAnalyze,
        topUpSafetyFactor: topUpSafetyFactor ?? DEFAULT_THRESHOLDS.topUpSafetyFactor,
        topUpMinStockDays: topUpMinStockDays ?? DEFAULT_THRESHOLDS.topUpMinStockDays
      }
    })

    return NextResponse.json({
      success: true,
      message: 'تم حفظ الإعدادات بنجاح',
      thresholds
    })
  } catch (error: any) {
    console.error('Save thresholds error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ في حفظ الإعدادات',
      details: error.message 
    }, { status: 500 })
  }
}

// إعادة الإعدادات للقيم الافتراضية
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const system = searchParams.get('system')

    if (!system) {
      return NextResponse.json({ error: 'المستودع مطلوب' }, { status: 400 })
    }

    await db.movementThresholds.delete({
      where: { system }
    }).catch(() => {}) // تجاهل الخطأ إذا لم يكن موجوداً

    return NextResponse.json({
      success: true,
      message: 'تم إعادة الإعدادات للقيم الافتراضية',
      thresholds: {
        system,
        ...DEFAULT_THRESHOLDS,
        isDefault: true
      }
    })
  } catch (error: any) {
    console.error('Reset thresholds error:', error)
    return NextResponse.json({ 
      error: 'حدث خطأ',
      details: error.message 
    }, { status: 500 })
  }
}
