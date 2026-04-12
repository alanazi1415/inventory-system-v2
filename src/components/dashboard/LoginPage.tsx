'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, ArrowRight, Shield } from "lucide-react"

interface LoginPageProps {
  onLogin: (user: any) => void
  onAdminLogin: () => void
}

export function LoginPage({ onLogin, onAdminLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/user-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await res.json()
      if (data.authenticated) {
        onLogin(data.user)
      } else {
        setError(data.error || 'كلمة المرور غير صحيحة')
      }
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Main Login Card */}
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">نظام دراسة المخزون</CardTitle>
            <CardDescription className="text-base">
              يرجى إدخال كلمة المرور للمتابعة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="pr-10 h-12 text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>
            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>
            )}
            <Button
              className="w-full h-12 text-lg font-medium"
              onClick={handleLogin}
              disabled={loading || !password}
            >
              {loading ? (
                'جاري التحقق...'
              ) : (
                <>
                  دخول
                  <ArrowRight className="w-5 h-5 mr-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Admin Link */}
        <div className="text-center">
          <button
            onClick={onAdminLogin}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            <Shield className="w-4 h-4" />
            دخول الأدمن
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400">
          <p>عايد حمود العنزي - مدير التخطيط</p>
          <p className="mt-1">إعداد: عبدالله فرحان العنزي - موظف نوبكو</p>
        </div>
      </div>
    </div>
  )
}
