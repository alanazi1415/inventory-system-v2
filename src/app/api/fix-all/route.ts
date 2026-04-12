import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: string[] = []

    // 1. إضافة الأعمدة الجديدة في User إذا لم تكن موجودة
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN IF NOT EXISTS "canEditMovementSettings" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "canClassifyMovement" BOOLEAN DEFAULT false
      `)
      results.push('✅ تم إضافة الأعمدة الجديدة في User')
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`⚠️ خطأ في إضافة الأعمدة في User: ${e.message}`)
      } else {
        results.push('✅ أعمدة User موجودة مسبقاً')
      }
    }

    // 2. حذف الأعمدة القديمة المتعلقة بـ TOP UP من User
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "User" 
        DROP COLUMN IF EXISTS "canViewTopUp",
        DROP COLUMN IF EXISTS "canCalculateTopUp"
      `)
      results.push('✅ تم حذف أعمدة TOP UP من User')
    } catch (e: any) {
      results.push(`⚠️ خطأ في حذف أعمدة TOP UP من User: ${e.message}`)
    }

    // 3. التحقق من وجود جدول ItemMovement وإنشاؤه إذا لم يكن موجوداً
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ItemMovement" (
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
          "lastAnalysisDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "reportSource" TEXT,
          "syncedFromInventory" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3),
          CONSTRAINT "ItemMovement_pkey" PRIMARY KEY ("id")
        )
      `)
      results.push('✅ تم التحقق من جدول ItemMovement')
    } catch (e: any) {
      results.push(`⚠️ خطأ في جدول ItemMovement: ${e.message}`)
    }

    // 4. إضافة الأعمدة الناقصة في ItemMovement
    const itemMovementColumns = [
      { name: 'userMovementClass', type: 'TEXT' },
      { name: 'classifiedBy', type: 'TEXT' },
      { name: 'classifiedAt', type: 'TIMESTAMP(3)' },
      { name: 'notes', type: 'TEXT' },
      { name: 'batchCount', type: 'INTEGER DEFAULT 0' },
      { name: 'uniqueExpiryDates', type: 'INTEGER DEFAULT 0' },
      { name: 'uniqueOrders', type: 'INTEGER DEFAULT 0' },
      { name: 'currentStock', type: 'DOUBLE PRECISION DEFAULT 0' },
      { name: 'availableStock', type: 'DOUBLE PRECISION DEFAULT 0' },
      { name: 'analysisPeriodDays', type: 'INTEGER DEFAULT 90' },
      { name: 'analysisDateFrom', type: 'TIMESTAMP(3)' },
      { name: 'analysisDateTo', type: 'TIMESTAMP(3)' },
      { name: 'lastAnalysisDate', type: 'TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP' },
      { name: 'reportSource', type: 'TEXT' },
      { name: 'syncedFromInventory', type: 'BOOLEAN DEFAULT false' },
    ]

    for (const col of itemMovementColumns) {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "ItemMovement" 
          ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}
        `)
      } catch (e: any) {
        // تجاهل أخطاء "already exists"
      }
    }
    results.push('✅ تم التحقق من أعمدة ItemMovement')

    // 5. إنشاء unique constraint إذا لم يكن موجوداً
    try {
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ItemMovement_genericItemNumber_system_key" 
        ON "ItemMovement"("genericItemNumber", "system")
      `)
      results.push('✅ تم إنشاء الفهرس الفريد لـ ItemMovement')
    } catch (e: any) {
      results.push(`⚠️ خطأ في إنشاء الفهرس الفريد: ${e.message}`)
    }

    // 6. إنشاء الفهارس لـ ItemMovement
    try {
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_genericItemNumber_idx" ON "ItemMovement"("genericItemNumber")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_system_idx" ON "ItemMovement"("system")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_autoMovementClass_idx" ON "ItemMovement"("autoMovementClass")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ItemMovement_userMovementClass_idx" ON "ItemMovement"("userMovementClass")`)
      results.push('✅ تم إنشاء فهارس ItemMovement')
    } catch (e: any) {
      results.push(`⚠️ خطأ في إنشاء فهارس ItemMovement: ${e.message}`)
    }

    // 7. التحقق من وجود جدول MovementReportLog
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
      results.push(`⚠️ خطأ في جدول MovementReportLog: ${e.message}`)
    }

    // 8. التحقق من وجود جدول ClassificationLog
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
      results.push(`⚠️ خطأ في جدول ClassificationLog: ${e.message}`)
    }

    // 9. إنشاء فهارس ClassificationLog
    try {
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassificationLog_itemNumber_idx" ON "ClassificationLog"("itemNumber")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassificationLog_system_idx" ON "ClassificationLog"("system")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassificationLog_createdAt_idx" ON "ClassificationLog"("createdAt")`)
      results.push('✅ تم إنشاء فهارس ClassificationLog')
    } catch (e: any) {
      results.push(`⚠️ خطأ في فهارس ClassificationLog: ${e.message}`)
    }

    // 10. التحقق من جدول MovementThresholds
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
      results.push(`⚠️ خطأ في جدول MovementThresholds: ${e.message}`)
    }

    // 11. إضافة عمود defaultAnalysisPeriod إذا لم يكن موجوداً
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "MovementThresholds" 
        ADD COLUMN IF NOT EXISTS "defaultAnalysisPeriod" INTEGER DEFAULT 90
      `)
    } catch (e: any) {
      // تجاهل
    }

    // 12. حذف أعمدة TOP UP من MovementThresholds
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "MovementThresholds" 
        DROP COLUMN IF EXISTS "topUpDaysToAnalyze",
        DROP COLUMN IF EXISTS "topUpSafetyFactor",
        DROP COLUMN IF EXISTS "topUpMinStockDays"
      `)
      results.push('✅ تم حذف أعمدة TOP UP من MovementThresholds')
    } catch (e: any) {
      results.push(`⚠️ خطأ في حذف أعمدة TOP UP: ${e.message}`)
    }

    // 13. تحديث قيم المستخدمين
    try {
      await db.$executeRawUnsafe(`
        UPDATE "User"
        SET "canEditMovementSettings" = COALESCE("canEditMovementSettings", false),
            "canClassifyMovement" = COALESCE("canClassifyMovement", false)
        WHERE "canEditMovementSettings" IS NULL
           OR "canClassifyMovement" IS NULL
      `)
      results.push('✅ تم تحديث قيم المستخدمين')
    } catch (e: any) {
      results.push(`⚠️ خطأ في تحديث المستخدمين: ${e.message}`)
    }

    // 14. جلب الإحصائيات
    const [users, itemMovementCount, reportLogCount] = await Promise.all([
      db.user.findMany({
        select: { id: true, username: true, name: true, isActive: true, canEditMovementSettings: true, canClassifyMovement: true }
      }),
      db.itemMovement.count().catch(() => 0),
      db.movementReportLog.count().catch(() => 0)
    ])

    results.push(`📊 إجمالي المستخدمين: ${users.length}`)
    results.push(`📊 إجمالي بنود الحركة: ${itemMovementCount}`)
    results.push(`📊 إجمالي تقارير الحركة: ${reportLogCount}`)

    return NextResponse.json({
      status: 'success',
      message: 'تم إصلاح قاعدة البيانات بنجاح',
      results,
      usersCount: users.length,
      itemMovementCount,
      reportLogCount,
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
