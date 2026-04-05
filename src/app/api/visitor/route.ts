import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { page, system } = body

    await db.visitorLog.create({
      data: {
        page: page || 'unknown',
        system: system || null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Visitor API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
