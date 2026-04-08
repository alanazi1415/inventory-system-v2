import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // اختبار الاتصال بقاعدة البيانات
    const userCount = await db.user.count()
    
    // جلب هيكل جدول المستخدمين
    const rawColumns = await db.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User'
      ORDER BY ordinal_position
    `
    
    return NextResponse.json({
      status: 'connected',
      userCount,
      columns: rawColumns
    })
  } catch (error: any) {
    console.error('Database debug error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 })
  }
}
