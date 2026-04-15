import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: any = {}

    // 1. إنشاء/تحديث جدول MovementThresholds
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MovementThresholds" (
          "id" TEXT NOT NULL,
          "system" TEXT NOT NULL,
          "veryFastMinTransactions" INTEGER NOT NULL DEFAULT 50,
          "veryFastMinQty" INTEGER NOT NULL DEFAULT 5000,
          "fastMinTransactions" INTEGER NOT NULL DEFAULT 20,
          "fastMinQty" INTEGER NOT NULL DEFAULT 2000,
          "mediumMinTransactions" INTEGER NOT NULL DEFAULT 10,
          "mediumMinQty" INTEGER NOT NULL DEFAULT 500,
          "slowMinTransactions" INTEGER NOT NULL DEFAULT 3,
          "defaultAnalysisPeriod" INTEGER NOT NULL DEFAULT 90,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "MovementThresholds_pkey" PRIMARY KEY ("id")
        )
      `)
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "MovementThresholds_system_key" ON "MovementThresholds"("system")
      `)
      results.movementThresholds = 'created successfully'
    } catch (e: any) {
      results.movementThresholds = { error: e.message }
    }

    // 2. إنشاء جدول ClassificationLog
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
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_itemNumber_idx" ON "ClassificationLog"("itemNumber")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_system_idx" ON "ClassificationLog"("system")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassificationLog_createdAt_idx" ON "ClassificationLog"("createdAt")
      `)
      results.classificationLog = 'created successfully'
    } catch (e: any) {
      results.classificationLog = { error: e.message }
    }

    // 3. إضافة الأعمدة الجديدة لجدول ItemMovement
    const newColumns = [
      { name: 'autoMovementClass', type: 'TEXT DEFAULT \'غير مصنف\'' },
      { name: 'userMovementClass', type: 'TEXT' },
      { name: 'classifiedBy', type: 'TEXT' },
      { name: 'classifiedAt', type: 'TIMESTAMP(3)' },
      { name: 'notes', type: 'TEXT' },
      { name: 'batchCount', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'uniqueExpiryDates', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'uniqueOrders', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'currentStock', type: 'DOUBLE PRECISION NOT NULL DEFAULT 0' },
      { name: 'availableStock', type: 'DOUBLE PRECISION NOT NULL DEFAULT 0' },
      { name: 'analysisPeriodDays', type: 'INTEGER NOT NULL DEFAULT 90' },
      { name: 'analysisDateFrom', type: 'TIMESTAMP(3)' },
      { name: 'analysisDateTo', type: 'TIMESTAMP(3)' },
      { name: 'syncedFromInventory', type: 'BOOLEAN NOT NULL DEFAULT false' },
    ]

    results.newColumns = {}
    for (const col of newColumns) {
      try {
        await db.$executeRawUnsafe(`
          SELECT ${col.name} FROM "ItemMovement" LIMIT 1
        `)
        results.newColumns[col.name] = 'already exists'
      } catch {
        try {
          await db.$executeRawUnsafe(`
            ALTER TABLE "ItemMovement" ADD COLUMN "${col.name}" ${col.type}
          `)
          results.newColumns[col.name] = 'added successfully'
        } catch (e: any) {
          results.newColumns[col.name] = { error: e.message }
        }
      }
    }

    // 4. إنشاء إعدادات افتراضية للمستودعين
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO "MovementThresholds" (id, system, "createdAt", "updatedAt")
        VALUES ('threshold_hoz', 'hoz', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (system) DO NOTHING
      `)
      await db.$executeRawUnsafe(`
        INSERT INTO "MovementThresholds" (id, system, "createdAt", "updatedAt")
        VALUES ('threshold_mwsal', 'mwsal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (system) DO NOTHING
      `)
      results.defaultThresholds = 'created for hoz and mwsal'
    } catch (e: any) {
      results.defaultThresholds = { error: e.message }
    }

    // 5. إضافة صلاحية التصنيف اليدوي للمستخدمين
    try {
      await db.$executeRawUnsafe(`
        SELECT "canClassifyMovement" FROM "User" LIMIT 1
      `)
      results.userPermission = 'already exists'
    } catch {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN "canClassifyMovement" BOOLEAN NOT NULL DEFAULT false
        `)
        results.userPermission = 'added successfully'
      } catch (e: any) {
        results.userPermission = { error: e.message }
      }
    }

    // 5.1 إضافة صلاحية البدائل الدوائية للمستخدمين
    try {
      await db.$executeRawUnsafe(`
        SELECT "canViewAlternatives" FROM "User" LIMIT 1
      `)
      results.userAlternativesPermission = 'already exists'
    } catch {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN "canViewAlternatives" BOOLEAN NOT NULL DEFAULT true
        `)
        results.userAlternativesPermission = 'added successfully'
      } catch (e: any) {
        results.userAlternativesPermission = { error: e.message }
      }
    }

    // 6. إنشاء جدول AlternativeGroup
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AlternativeGroup" (
          "id" TEXT NOT NULL,
          "itemNumber" TEXT NOT NULL,
          "description" TEXT,
          "notes" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AlternativeGroup_pkey" PRIMARY KEY ("id")
        )
      `)
      // إزالة الـ UNIQUE index إذا كان موجوداً (لأن البند الواحد قد يكون له عدة بدائل في صفوف مختلفة)
      try {
        await db.$executeRawUnsafe(`
          DROP INDEX IF EXISTS "AlternativeGroup_itemNumber_key"
        `)
      } catch (e) {
        // ignore
      }
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AlternativeGroup_itemNumber_idx" ON "AlternativeGroup"("itemNumber")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AlternativeGroup_isActive_idx" ON "AlternativeGroup"("isActive")
      `)
      results.alternativeGroup = 'created successfully'
    } catch (e: any) {
      results.alternativeGroup = { error: e.message }
    }

    // 7. إنشاء جدول AlternativeItem
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AlternativeItem" (
          "id" TEXT NOT NULL,
          "groupId" TEXT NOT NULL,
          "itemNumber" TEXT NOT NULL,
          "description" TEXT,
          "sortOrder" INTEGER NOT NULL DEFAULT 1,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AlternativeItem_pkey" PRIMARY KEY ("id")
        )
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AlternativeItem_groupId_idx" ON "AlternativeItem"("groupId")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AlternativeItem_itemNumber_idx" ON "AlternativeItem"("itemNumber")
      `)
      // إضافة Foreign Key
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "AlternativeItem" 
          ADD CONSTRAINT "AlternativeItem_groupId_fkey" 
          FOREIGN KEY ("groupId") REFERENCES "AlternativeGroup"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE
        `)
        results.alternativeItem = 'created successfully with FK'
      } catch (fkError: any) {
        // FK might already exist
        results.alternativeItem = 'created successfully (FK may exist)'
      }
    } catch (e: any) {
      results.alternativeItem = { error: e.message }
    }

    // 8. التحقق من الجداول بعد الإنشاء
    try {
      const tablesCheck = await db.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('MovementThresholds', 'ClassificationLog', 'ItemMovement', 'AlternativeGroup', 'AlternativeItem', 'DeliveryCenter')
      `
      results.tablesCheck = tablesCheck
    } catch (e: any) {
      results.tablesCheck = { error: e.message }
    }

    // 9. إضافة صلاحية جدول التوصيل للمستخدمين
    try {
      await db.$executeRawUnsafe(`
        SELECT "canViewDelivery" FROM "User" LIMIT 1
      `)
      results.userDeliveryPermission = 'already exists'
    } catch {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN "canViewDelivery" BOOLEAN NOT NULL DEFAULT true
        `)
        results.userDeliveryPermission = 'added successfully'
      } catch (e: any) {
        results.userDeliveryPermission = { error: e.message }
      }
    }

    // 10. إنشاء جدول DeliveryCenter
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DeliveryCenter" (
          "id" TEXT NOT NULL,
          "nameEn" TEXT NOT NULL,
          "nameAr" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "deliveryDay" INTEGER NOT NULL,
          "deliveryDayEn" TEXT NOT NULL,
          "deliveryDayAr" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "lastApproved" TIMESTAMP(3),
          "approvedBy" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "DeliveryCenter_pkey" PRIMARY KEY ("id")
        )
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeliveryCenter_deliveryDay_idx" ON "DeliveryCenter"("deliveryDay")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeliveryCenter_code_idx" ON "DeliveryCenter"("code")
      `)
      results.deliveryCenter = 'created successfully'
    } catch (e: any) {
      results.deliveryCenter = { error: e.message }
    }

    return NextResponse.json({
      status: 'success',
      message: 'تم إنشاء/تحديث الجداول الناجحة',
      results
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
