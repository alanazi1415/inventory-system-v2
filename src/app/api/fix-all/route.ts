import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: string[] = []

    // 1. إضافة الأعمدة الجديدة إذا لم تكن موجودة
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN IF NOT EXISTS "canEditMovementSettings" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "canClassifyMovement" BOOLEAN DEFAULT false
      `)
      results.push('✅ تم إضافة الأعمدة الجديدة (canEditMovementSettings, canClassifyMovement)')
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`⚠️ خطأ في إضافة الأعمدة الجديدة: ${e.message}`)
      } else {
        results.push('✅ الأعمدة الجديدة موجودة مسبقاً')
      }
    }

    // 2. حذف الأعمدة القديمة المتعلقة بـ TOP UP إذا كانت موجودة
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        DROP COLUMN IF EXISTS "canViewTopUp",
        DROP COLUMN IF EXISTS "canCalculateTopUp"
      `)
      results.push('✅ تم حذف أعمدة TOP UP القديمة')
    } catch (e: any) {
      results.push(`⚠️ خطأ في حذف أعمدة TOP UP: ${e.message}`)
    }

    // 3. تحديث قيم الأعمدة الجديدة للمستخدمين الحاليين
    try {
      await db.$executeRawUnsafe(`
        UPDATE "User"
        SET "canEditMovementSettings" = COALESCE("canEditMovementSettings", false),
            "canClassifyMovement" = COALESCE("canClassifyMovement", false)
        WHERE "canEditMovementSettings" IS NULL
           OR "canClassifyMovement" IS NULL
      `)
      results.push('✅ تم تحديث قيم المستخدمين الحاليين')
    } catch (e: any) {
      results.push(`⚠️ خطأ في تحديث قيم المستخدمين: ${e.message}`)
    }

    // 4. التحقق من وجود جدول ClassificationLog وإنشاؤه إذا لم يكن موجوداً
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClassificationLog" (
          "id" TEXT NOT NULL,
          "itemNumber" TEXT NOT NULL,
          "system" TEXT NOT NULL,
          "oldClass" TEXT,
          "newClass" TEXT NOT NULL,
          "changedBy" TEXT NOT NULL,
          "reason" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ClassificationLog_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم التحقق من جدول ClassificationLog')
    } catch (e: any) {
      results.push(`⚠️ خطأ في إنشاء جدول ClassificationLog: ${e.message}`)
    }

    // 5. إنشاء الفهارس لجدول ClassificationLog
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_itemNumber_idx" ON "ClassificationLog"("itemNumber")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_system_idx" ON "ClassificationLog"("system")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_createdAt_idx" ON "ClassificationLog"("createdAt")
      `)
      results.push('✅ تم إنشاء فهارس ClassificationLog')
    } catch (e: any) {
      results.push(`⚠️ خطأ في إنشاء الفهارس: ${e.message}`)
    }

    // 6. التحقق من وجود الأعمدة في MovementThresholds
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "MovementThresholds" 
        ADD COLUMN IF NOT EXISTS "defaultAnalysisPeriod" INTEGER DEFAULT 90
      `)
      results.push('✅ تم التحقق من عمود defaultAnalysisPeriod')
    } catch (e: any) {
      results.push(`⚠️ خطأ في عمود defaultAnalysisPeriod: ${e.message}`)
    }

    // 7. حذف أعمدة TOP UP من MovementThresholds
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "MovementThresholds" 
        DROP COLUMN IF EXISTS "topUpDaysToAnalyze",
        DROP COLUMN IF EXISTS "topUpSafetyFactor",
        DROP COLUMN IF EXISTS "topUpMinStockDays"
      `)
      results.push('✅ تم حذف أعمدة TOP UP من MovementThresholds')
    } catch (e: any) {
      results.push(`⚠️ خطأ في حذف أعمدة TOP UP من MovementThresholds: ${e.message}`)
    }

    // 8. حذف جميع الجلسات القديمة
    await db.userSession.deleteMany({})
    results.push('✅ تم حذف جميع جلسات المستخدمين القديمة')

    // 9. جلب المستخدمين بعد التحديث
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        canEditMovementSettings: true,
        canClassifyMovement: true
      }
    })

    return NextResponse.json({
      status: 'success',
      message: 'تم إصلاح قاعدة البيانات بنجاح',
      results,
      usersCount: users.length,
      users
    })
  } catch (error: any) {
    console.error('Fix all error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code
    }, { status: 500 })
  }
}
