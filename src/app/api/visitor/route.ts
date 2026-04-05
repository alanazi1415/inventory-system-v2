import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { page, system } = body

    // الجدول يحتوي على: id, sessionId (NOT NULL), page, system, visitedAt (NOT NULL), ipAddress
    await db.$executeRaw`
      INSERT INTO "VisitorLog" (id, "sessionId", page, system, "visitedAt")
      VALUES (
        gen_random_uuid(),
        gen_random_uuid(),
        ${page || 'unknown'},
        ${system || null},
        NOW()
      )
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Visitor API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
