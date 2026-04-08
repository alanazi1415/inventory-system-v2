import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // إضافة الأعمدة الناقصة يدوياً
    await db.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "canEditMovementSettings" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "canViewTopUp" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "canCalculateTopUp" BOOLEAN NOT NULL DEFAULT false
    `)
    
    // التحقق من الأعمدة بعد الإضافة
    const columns = await db.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User'
      ORDER BY ordinal_position
    `
    
    return NextResponse.json({
      status: 'success',
      message: 'تم إضافة الأعمدة الناقصة',
      columns
    })
  } catch (error: any) {
    console.error('Fix schema error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code
    }, { status: 500 })
  }
}
