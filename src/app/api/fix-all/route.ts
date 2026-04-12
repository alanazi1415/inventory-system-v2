import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: string[] = []

    // 1. التحقق من وجود جدول ItemMotion وإنشاؤه بالكامل
    try {
      // أولاً نحذف الجدول القديم إذا كان ناقصاً
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ItemMovement"`)
      
      // ننشئ الجدول بالكامل
      await db.$executeRawUnsafe(`
        CREATE TABLE "ItemMovement" (
          "id" TEXT NOT NULL,
          "genericItemNumber" TEXT NOT NULL,
          "description" TEXT,
          "system" TEXT NOT NULL,
          "totalQtyDispatched" DOUBLE PRECISION DEFAULT 0,
          "transactionCount" INTEGER DEFAULT 0,
          "avgQtyPerTransaction" DOUBLE PRECISION DEFAULT 0,
          "firstDispatchDate" TIMESTAMP(3),
          "lastDispatchDate" TIMESTAMP(3),
          "daysSpan" INTEGER DEFAULT 0,
          "autoMovementClass" TEXT DEFAULT 'غير مصنف',
          "movementScore" DOUBLE PRECISION DEFAULT 0,
          "userMovementClass" TEXT,
          "classifiedBy" TEXT,
          "classifiedAt" TIMESTAMP(3),
          "notes" TEXT,
          "batchCount" INTEGER DEFAULT 0,
          "uniqueExpiryDates" INTEGER DEFAULT 0,
          "uniqueOrders" INTEGER DEFAULT 0,
          "currentStock" DOUBLE PRECISION DEFAULT 0,
          "availableStock" DOUBLE PRECISION DEFAULT 0,
          "analysisPeriodDays" INTEGER DEFAULT 90,
          "analysisDateFrom" TIMESTAMP(3),
          "analysisDateTo" TIMESTAMP(3),
          "lastAnalysisDate" TIMESTAMP(3),
          "reportSource" TEXT,
          "syncedFromInventory" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3),
          CONSTRAINT "ItemMovement_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم إنشاء جدول ItemMovement بالكامل')
    } catch (e: any) {
      results.push(`⚠️ خطأ في إنشاء ItemMovement: ${e.message}`)
    }

    // 2. إنشاء الفهارس
    try {
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_genericItemNumber_idx" ON "ItemMovement"("genericItemNumber")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_system_idx" ON "ItemMovement"("system")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_autoMovementClass_idx" ON "ItemMovement"("autoMovementClass")`)
      results.push('✅ تم إنشاء فهارس ItemMovement')
    } catch (e: any) {
      results.push(`⚠️ خطأ في الفهارس: ${e.message}`)
    }

    // 3. إنشاء فهرس فريد
    try {
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ItemMovement_genericItemNumber_system_key" 
        ON "ItemMovement"("genericItemNumber", "system")
      `)
      results.push('✅ تم إنشاء الفهرس الفريد')
    } catch (e: any) {
      results.push(`⚠️ خطأ في الفهرس الفريد: ${e.message}`)
    }

    // 4. التحقق من جدول MovementReportLog
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MovementReportLog" (
          "id" TEXT NOT NULL,
          "fileName" TEXT NOT NULL,
          "system" TEXT NOT NULL,
          "recordsCount" INTEGER DEFAULT 0,
          "itemsCount" INTEGER DEFAULT 0,
          "dateFrom" TIMESTAMP(3),
          "dateTo" TIMESTAMP(3),
          "analysisPeriodDays" INTEGER DEFAULT 90,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "MovementReportLog_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم التحقق من جدول MovementReportLog')
    } catch (e: any) {
      results.push(`⚠️ خطأ في MovementReportLog: ${e.message}`)
    }

    // 5. التحقق من جدول ClassificationLog
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
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ClassificationLog_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم التحقق من جدول ClassificationLog')
    } catch (e: any) {
      results.push(`⚠️ خطأ في ClassificationLog: ${e.message}`)
    }

    // 6. فهارس ClassificationLog
    try {
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassificationLog_itemNumber_idx" ON "ClassificationLog"("itemNumber")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassificationLog_system_idx" ON "ClassificationLog"("system")`)
      results.push('✅ تم إنشاء فهارس ClassificationLog')
    } catch (e: any) {
      // تجاهل
    }

    // 7. التحقق من جدول MovementThresholds
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MovementThresholds" (
          "id" TEXT NOT NULL,
          "system" TEXT NOT NULL UNIQUE,
          "veryFastMinTransactions" INTEGER DEFAULT 50,
          "veryFastMinQty" INTEGER DEFAULT 5000,
          "fastMinTransactions" INTEGER DEFAULT 20,
          "fastMinQty" INTEGER DEFAULT 2000,
          "mediumMinTransactions" INTEGER DEFAULT 10,
          "mediumMinQty" INTEGER DEFAULT 500,
          "slowMinTransactions" INTEGER DEFAULT 3,
          "defaultAnalysisPeriod" INTEGER DEFAULT 90,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3),
          CONSTRAINT "MovementThresholds_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم التحقق من جدول MovementThresholds')
    } catch (e: any) {
      results.push(`⚠️ خطأ في MovementThresholds: ${e.message}`)
    }

    // 8. التحقق من أعمدة User
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN IF NOT EXISTS "canEditMovementSettings" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "canClassifyMovement" BOOLEAN DEFAULT false
      `)
      results.push('✅ تم التحقق من أعمدة User')
    } catch (e: any) {
      // تجاهل
    }

    // 9. حذف أعمدة TOP UP القديمة من User
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        DROP COLUMN IF EXISTS "canViewTopUp",
        DROP COLUMN IF EXISTS "canCalculateTopUp"
      `)
    } catch (e: any) {
      // تجاهل
    }

    // 10. تحديث قيم المستخدمين
    try {
      await db.$executeRawUnsafe(`
        UPDATE "User"
        SET "canEditMovementSettings" = COALESCE("canEditMovementSettings", false),
            "canClassifyMovement" = COALESCE("canClassifyMovement", false)
        WHERE "canEditMovementSettings" IS NULL OR "canClassifyMovement" IS NULL
      `)
    } catch (e: any) {
      // تجاهل
    }

    // 11. حذف جلسات قديمة
    try {
      await db.userSession.deleteMany({})
    } catch (e: any) {
      // تجاهل
    }

    // 12. جلب الإحصائيات
    let itemMovementCount = 0
    try {
      itemMovementCount = await db.itemMovement.count()
    } catch (e) {
      // تجاهل
    }

    const users = await db.user.findMany({
      select: { id: true, username: true, name: true, isActive: true, canEditMovementSettings: true, canClassifyMovement: true }
    })

    results.push(`📊 إجمالي المستخدمين: ${users.length}`)
    results.push(`📊 بنود الحركة: ${itemMovementCount}`)

    return NextResponse.json({
      status: 'success',
      message: 'تم إصلاح قاعدة البيانات بنجاح',
      results,
      itemMovementCount,
      usersCount: users.length,
      users
    })
  } catch (error: any) {
    console.error('Fix all error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}
