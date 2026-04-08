import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results: any = {}

    // 1. إنشاء جدول MovementThresholds
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
          "topUpDaysToAnalyze" INTEGER NOT NULL DEFAULT 90,
          "topUpSafetyFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
          "topUpMinStockDays" INTEGER NOT NULL DEFAULT 30,
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

    // 2. إنشاء جدول TopUpSuggestion
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TopUpSuggestion" (
          "id" TEXT NOT NULL,
          "genericItemNumber" TEXT NOT NULL,
          "description" TEXT,
          "system" TEXT NOT NULL,
          "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "availableStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "avgDailyConsumption" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "daysOfStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "suggestedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "urgencyLevel" TEXT NOT NULL DEFAULT 'متوسط',
          "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "analysisPeriodDays" INTEGER NOT NULL DEFAULT 90,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TopUpSuggestion_pkey" PRIMARY KEY ("id")
        )
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "TopUpSuggestion_genericItemNumber_idx" ON "TopUpSuggestion"("genericItemNumber")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "TopUpSuggestion_system_idx" ON "TopUpSuggestion"("system")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "TopUpSuggestion_urgencyLevel_idx" ON "TopUpSuggestion"("urgencyLevel")
      `)
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "TopUpSuggestion_genericItemNumber_system_key" ON "TopUpSuggestion"("genericItemNumber", "system")
      `)
      results.topUpSuggestion = 'created successfully'
    } catch (e: any) {
      results.topUpSuggestion = { error: e.message }
    }

    // 3. إنشاء إعدادات افتراضية للمستودعين
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

    // 4. التحقق من الجداول بعد الإنشاء
    try {
      const thresholdsCheck = await db.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('MovementThresholds', 'TopUpSuggestion')
      `
      results.tablesCheck = thresholdsCheck
    } catch (e: any) {
      results.tablesCheck = { error: e.message }
    }

    return NextResponse.json({
      status: 'success',
      message: 'تم إنشاء الجداول الناقصة',
      results
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
