import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    console.log('Admin session cookie:', session?.value ? 'exists' : 'not found')
    
    if (session?.value) {
      const adminSession = await db.adminSession.findUnique({
        where: { token: session.value }
      })
      
      console.log('Admin session in DB:', adminSession ? 'found' : 'not found')
      
      if (adminSession) {
        const isExpired = adminSession.expiresAt < new Date()
        console.log('Session expired:', isExpired)
        
        return NextResponse.json({
          hasCookie: true,
          sessionInDb: true,
          token: session.value.substring(0, 10) + '...',
          expiresAt: adminSession.expiresAt,
          isExpired: isExpired,
          isValid: !isExpired
        })
      }
      
      return NextResponse.json({
        hasCookie: true,
        sessionInDb: false,
        token: session.value.substring(0, 10) + '...',
        isValid: false
      })
    }
    
    return NextResponse.json({
      hasCookie: false,
      sessionInDb: false,
      isValid: false
    })
  } catch (error: any) {
    console.error('Check session error:', error)
    return NextResponse.json({
      error: error.message,
      isValid: false
    }, { status: 500 })
  }
}
